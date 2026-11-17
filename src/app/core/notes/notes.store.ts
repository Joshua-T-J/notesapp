import {
  DestroyRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Block, firstLine, searchableText } from '../content/blocks';
import { newId } from '../platform/ids';
import {
  FOLDER_COLORS,
  Folder,
  FolderColor,
  FolderColorChoice,
  Note,
  NoteView,
  SortBy,
  Workspace,
  WORKSPACE_VERSION,
} from './note.model';
import { LoadSource, NotesRepository } from './notes.repository';

export type SaveState = 'saved' | 'saving' | 'error';

export interface FolderEntry extends Folder {
  count: number;
}

export interface TagEntry {
  tag: string;
  count: number;
}

export interface ViewCounts {
  all: number;
  pinned: number;
  locked: number;
  trash: number;
}

const SAVE_DELAY_MS = 400;

const byUpdated = (a: Note, b: Note) => b.updatedAt - a.updatedAt;
const byCreated = (a: Note, b: Note) => b.createdAt - a.createdAt;
const byTitle = (a: Note, b: Note) =>
  (a.title || 'Untitled').localeCompare(b.title || 'Untitled', undefined, { sensitivity: 'base' });

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase().slice(0, 60);
}

/**
 * Notes, folders and the note-list view state. Components read the signals and call the actions;
 * persistence goes through the injected `NotesRepository`, debounced.
 *
 * Provided by the `/app` routes (see notes.routes.ts) so the data layer, including validation,
 * is not part of the public pages' bundle.
 */
@Injectable()
export class NotesStore {
  private readonly repo = inject(NotesRepository);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ---- data --------------------------------------------------------------
  private readonly _notes = signal<Note[]>([]);
  private readonly _folders = signal<Folder[]>([]);
  readonly notes = this._notes.asReadonly();
  readonly folders = this._folders.asReadonly();
  readonly loaded = signal(false);
  readonly loadSource = signal<LoadSource | null>(null);
  readonly saveState = signal<SaveState>('saved');

  // ---- view state ----------------------------------------------------------
  readonly view = signal<NoteView>({ kind: 'all' });
  readonly tag = signal<string | null>(null);
  readonly search = signal('');
  readonly sortBy = signal<SortBy>('updated');
  readonly openNoteId = signal<string | null>(null);
  private readonly _unlocked = signal<ReadonlySet<string>>(new Set());
  readonly unlocked = this._unlocked.asReadonly();

  // ---- derived -------------------------------------------------------------
  readonly liveNotes = computed(() => this._notes().filter((n) => n.trashedAt === null));

  readonly counts = computed<ViewCounts>(() => {
    const live = this.liveNotes();
    return {
      all: live.length,
      pinned: live.filter((n) => n.pinned).length,
      locked: live.filter((n) => n.locked).length,
      trash: this._notes().length - live.length,
    };
  });

  readonly folderEntries = computed<FolderEntry[]>(() => {
    const live = this.liveNotes();
    return this._folders().map((f) => ({
      ...f,
      count: live.filter((n) => n.folderId === f.id).length,
    }));
  });

  readonly folderById = computed(() => new Map(this._folders().map((f) => [f.id, f])));

  readonly tagEntries = computed<TagEntry[]>(() => {
    const counts = new Map<string, number>();
    for (const note of this.liveNotes()) {
      for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, count]) => ({ tag, count }));
  });

  readonly isTrashView = computed(() => this.view().kind === 'trash');

  readonly viewTitle = computed(() => {
    const view = this.view();
    switch (view.kind) {
      case 'all':
        return 'All notes';
      case 'pinned':
        return 'Pinned';
      case 'locked':
        return 'Locked';
      case 'trash':
        return 'Trash';
      case 'folder':
        return this.folderById().get(view.folderId)?.name ?? 'Folder';
    }
  });

  /** Notes for the current view, tag and search, sorted. Pinned notes lead outside Trash. */
  readonly listNotes = computed<Note[]>(() => {
    const view = this.view();
    const tag = this.tag();
    const query = this.search().trim().toLowerCase();
    const source =
      view.kind === 'trash' ? this._notes().filter((n) => n.trashedAt !== null) : this.liveNotes();

    const filtered = source.filter((n) => {
      if (view.kind === 'pinned' && !n.pinned) return false;
      if (view.kind === 'locked' && !n.locked) return false;
      if (view.kind === 'folder' && n.folderId !== view.folderId) return false;
      if (tag && !n.tags.includes(tag)) return false;
      if (!query) return true;
      // Locked notes are only matched on title and tags, never on hidden text.
      const haystack = [
        n.title,
        ...n.tags.map((t) => `#${t}`),
        n.locked ? '' : searchableText(n.body),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });

    const sorter = { updated: byUpdated, created: byCreated, title: byTitle }[this.sortBy()];
    return filtered.sort((a, b) =>
      view.kind !== 'trash' && a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : sorter(a, b),
    );
  });

  readonly openNote = computed(() => {
    const id = this.openNoteId();
    return id ? (this._notes().find((n) => n.id === id) ?? null) : null;
  });

  constructor() {
    if (!this.isBrowser) {
      return;
    }
    void this.load();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
      void this.persist();
    };
    effect(() => {
      this._notes();
      this._folders();
      if (!untracked(this.loaded)) return;
      untracked(() => this.saveState.set('saving'));
      clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DELAY_MS);
    });

    // Never lose the last keystrokes when the tab is closed or hidden.
    const onHide = () => flush();
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      flush();
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  // ---- loading / persistence -----------------------------------------------
  private async load(): Promise<void> {
    try {
      const { workspace, source } = await this.repo.load();
      this.setWorkspace(workspace);
      this.loadSource.set(source);
    } catch {
      this.loadSource.set('recovered');
    } finally {
      this.loaded.set(true);
    }
  }

  private async persist(): Promise<void> {
    try {
      await this.repo.save(this.snapshot());
      this.saveState.set('saved');
    } catch {
      // Usually QuotaExceededError or storage disabled. Data stays in memory; the UI says so.
      this.saveState.set('error');
    }
  }

  snapshot(): Workspace {
    return { version: WORKSPACE_VERSION, notes: this._notes(), folders: this._folders() };
  }

  private setWorkspace(ws: Workspace): void {
    this._folders.set(ws.folders);
    this._notes.set(ws.notes);
  }

  // ---- view actions ----------------------------------------------------------
  setView(view: NoteView): void {
    this.view.set(view);
  }

  toggleTag(tag: string): void {
    this.tag.update((current) => (current === tag ? null : tag));
  }

  // ---- note actions ----------------------------------------------------------
  /**
   * What a new note inherits from the current view, so it shows up where you are looking:
   * the folder being browsed, the active tag, and "pinned" / "locked" in those views.
   */
  readonly newNoteContext = computed(() => {
    const view = this.view();
    const tag = this.tag();
    const parts: string[] = [];
    if (view.kind === 'folder')
      parts.push(`in ${this.folderById().get(view.folderId)?.name ?? 'folder'}`);
    if (tag) parts.push(`tagged #${tag}`);
    return {
      folderId: view.kind === 'folder' ? view.folderId : null,
      tags: tag ? [tag] : [],
      pinned: view.kind === 'pinned',
      locked: view.kind === 'locked',
      label: [view.kind === 'pinned' ? 'pinned' : view.kind === 'locked' ? 'locked' : '', ...parts]
        .filter(Boolean)
        .join(', '),
    };
  });

  /** Creates an empty note that matches the current filters and returns its id. */
  createNote(): string {
    const now = Date.now();
    const ctx = this.newNoteContext();
    const note: Note = {
      id: newId(),
      title: '',
      folderId: ctx.folderId,
      tags: [...ctx.tags],
      pinned: ctx.pinned,
      locked: ctx.locked,
      trashedAt: null,
      createdAt: now,
      updatedAt: now,
      body: [],
    };
    if (this.view().kind === 'trash') this.view.set({ kind: 'all' });
    // Search is cleared so the new, empty note is visible in the list.
    this.search.set('');
    this._notes.update((notes) => [note, ...notes]);
    // A note you just created in the Locked view should be writable straight away.
    if (note.locked) this.unlock(note.id);
    return note.id;
  }

  private patch(id: string, change: (note: Note) => Partial<Note>, touch = true): void {
    this._notes.update((notes) =>
      notes.map((n) =>
        n.id === id ? { ...n, ...change(n), ...(touch ? { updatedAt: Date.now() } : {}) } : n,
      ),
    );
  }

  setTitle(id: string, title: string): void {
    this.patch(id, () => ({ title: title.slice(0, 500) }));
  }

  setBody(id: string, body: Block[]): void {
    this.patch(id, () => ({ body }));
  }

  setFolder(id: string, folderId: string | null): void {
    this.patch(id, () => ({ folderId }));
  }

  togglePin(id: string): void {
    this.patch(id, (n) => ({ pinned: !n.pinned }), false);
  }

  toggleLock(id: string): void {
    this.patch(id, (n) => ({ locked: !n.locked }), false);
    this.relock(id);
  }

  unlock(id: string): void {
    this._unlocked.update((set) => new Set(set).add(id));
  }

  relock(id: string): void {
    this._unlocked.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  isHidden(note: Note): boolean {
    return note.locked && !this._unlocked().has(note.id);
  }

  addTag(id: string, raw: string): void {
    const tag = normalizeTag(raw);
    if (!tag) return;
    this.patch(id, (n) => ({ tags: n.tags.includes(tag) ? n.tags : [...n.tags, tag] }));
  }

  removeTag(id: string, tag: string): void {
    this.patch(id, (n) => ({ tags: n.tags.filter((t) => t !== tag) }));
  }

  duplicate(id: string): string | null {
    const source = this._notes().find((n) => n.id === id);
    if (!source) return null;
    const now = Date.now();
    const copy: Note = {
      ...structuredClone(source),
      id: newId(),
      title: source.title ? `${source.title} (copy)` : '',
      pinned: false,
      trashedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this._notes.update((notes) => [copy, ...notes]);
    return copy.id;
  }

  trash(id: string): void {
    this.patch(id, () => ({ trashedAt: Date.now(), pinned: false }), false);
  }

  restore(id: string): void {
    this.patch(id, () => ({ trashedAt: null }), false);
  }

  deleteForever(id: string): void {
    this._notes.update((notes) => notes.filter((n) => n.id !== id));
    this.relock(id);
  }

  emptyTrash(): void {
    this._notes.update((notes) => notes.filter((n) => n.trashedAt === null));
  }

  // ---- folders ---------------------------------------------------------------
  /** Returns the new folder's id, or the existing one when the name is taken. */
  addFolder(rawName: string, color: FolderColorChoice = 'random'): string | null {
    const name = rawName.trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!name) return null;
    const existing = this._folders().find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const now = Date.now();
    const folder: Folder = {
      id: newId(),
      name,
      color: this.resolveColor(color),
      createdAt: now,
      updatedAt: now,
    };
    this._folders.update((folders) => [...folders, folder]);
    return folder.id;
  }

  renameFolder(id: string, rawName: string): void {
    const name = rawName.trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!name) return;
    this._folders.update((folders) =>
      folders.map((f) => (f.id === id ? { ...f, name, updatedAt: Date.now() } : f)),
    );
  }

  setFolderColor(id: string, color: FolderColorChoice): void {
    const resolved = this.resolveColor(color);
    this._folders.update((folders) =>
      folders.map((f) => (f.id === id ? { ...f, color: resolved, updatedAt: Date.now() } : f)),
    );
  }

  /** `random` prefers colours no folder uses yet, so random picks rarely clash. */
  private resolveColor(choice: FolderColorChoice): FolderColor {
    if (choice !== 'random') return choice;
    const used = new Set(this._folders().map((f) => f.color));
    const unused = FOLDER_COLORS.filter((c) => !used.has(c));
    const pool = unused.length ? unused : FOLDER_COLORS;
    return pool[Math.floor(Math.random() * pool.length)] as FolderColor;
  }

  /** Deletes the folder; its notes stay, without a folder. */
  deleteFolder(id: string): void {
    this._folders.update((folders) => folders.filter((f) => f.id !== id));
    this._notes.update((notes) =>
      notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)),
    );
    const view = this.view();
    if (view.kind === 'folder' && view.folderId === id) this.view.set({ kind: 'all' });
  }

  // ---- whole-workspace operations -------------------------------------------
  /** Adds notes and folders from a backup. Items with the same id keep whichever was edited last. */
  importWorkspace(incoming: Workspace): { notes: number; folders: number } {
    const folders = new Map(this._folders().map((f) => [f.id, f]));
    let folderCount = 0;
    for (const f of incoming.folders) {
      const current = folders.get(f.id);
      if (!current || f.updatedAt > current.updatedAt) {
        folders.set(f.id, f);
        folderCount++;
      }
    }
    const notes = new Map(this._notes().map((n) => [n.id, n]));
    let noteCount = 0;
    for (const n of incoming.notes) {
      const current = notes.get(n.id);
      if (!current || n.updatedAt > current.updatedAt) {
        notes.set(n.id, n);
        noteCount++;
      }
    }
    this._folders.set([...folders.values()]);
    this._notes.set([...notes.values()]);
    return { notes: noteCount, folders: folderCount };
  }

  async deleteEverything(): Promise<void> {
    await this.repo.clear();
    this.loaded.set(false);
    this.setWorkspace({ version: WORKSPACE_VERSION, notes: [], folders: [] });
    this.view.set({ kind: 'all' });
    this.tag.set(null);
    this.search.set('');
    this._unlocked.set(new Set());
    this.saveState.set('saved');
    this.loaded.set(true);
  }

  snippetFor(note: Note): string {
    return firstLine(note.body);
  }
}
