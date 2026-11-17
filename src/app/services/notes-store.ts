import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { FOLDER_TONES, UNFILED_TONE } from '../data/folder-colors';
import { createDefaultNotes, DEFAULT_FOLDERS } from '../data/default-notes';
import {
  ActiveView,
  EditorMode,
  FolderColorKey,
  FolderTone,
  Note,
  NotePatch,
  QuickView,
  SortBy,
} from '../models/note.model';
import { toggleTaskLine } from '../utils/markdown';
import { ConfirmService } from './confirm.service';

const STORAGE_KEY_NOTES = 'nota_lively_notes_v4';
const STORAGE_KEY_FOLDERS = 'nota_lively_folders_v4';
const STORAGE_KEY_FOLDER_COLORS = 'nota_lively_folder_colors_v4';
const FOLDER_PREFIX = 'folder:';

export interface FolderEntry {
  name: string;
  view: ActiveView;
  count: number;
  tone: FolderTone;
}

export interface TagEntry {
  tag: string;
  count: number;
}

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — notes stay in memory for this session.
  }
}

function newId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Single source of truth for notes, folders and all workspace UI state.
 * Components read signals/computeds and call the action methods below.
 */
@Injectable({ providedIn: 'root' })
export class NotesStore {
  // ---- Persisted data -----------------------------------------------------
  readonly notes = signal<Note[]>(this.loadNotes());
  readonly folders = signal<string[]>(this.loadFolders());
  /** Explicit folder colors. A folder with no entry uses "Auto" (palette by position). */
  readonly folderColors = signal<Record<string, FolderColorKey>>(this.loadFolderColors());

  private readonly confirm = inject(ConfirmService);

  // ---- Workspace / UI state ----------------------------------------------
  readonly activeView = signal<ActiveView>('all');
  readonly activeTag = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly sortBy = signal<SortBy>('updated');
  readonly selectedNoteId = signal<string | null>(null);
  readonly detailNoteId = signal<string | null>(null);
  readonly unlockedNoteIds = signal<ReadonlySet<string>>(new Set());
  readonly privacyShieldOn = signal(true);
  readonly editorMode = signal<EditorMode>('split');
  readonly focusMode = signal(false);
  readonly sidebarOpen = signal(true);
  readonly saving = signal(false);
  /** Set when a brand-new note opens so the studio can focus + select its title. */
  readonly pendingTitleFocusId = signal<string | null>(null);

  // ---- Derived state ------------------------------------------------------
  readonly activeNotes = computed(() => this.notes().filter((n) => !n.trashed));

  readonly counts = computed<Record<QuickView, number>>(() => {
    const active = this.activeNotes();
    return {
      all: active.length,
      unfiled: active.filter((n) => !n.folder).length,
      pinned: active.filter((n) => n.pinned).length,
      sensitive: active.filter((n) => n.sensitive).length,
      trash: this.notes().filter((n) => n.trashed).length,
    };
  });

  readonly isTrashView = computed(() => this.activeView() === 'trash');

  /** Name of the folder currently being browsed, or `null` outside a folder view. */
  readonly activeFolderName = computed<string | null>(() => {
    const view = this.activeView();
    return view.startsWith(FOLDER_PREFIX) ? view.slice(FOLDER_PREFIX.length) : null;
  });

  readonly folderEntries = computed<FolderEntry[]>(() => {
    const active = this.activeNotes();
    return this.folders().map((name) => ({
      name,
      view: `${FOLDER_PREFIX}${name}` as ActiveView,
      count: active.filter((n) => n.folder === name).length,
      tone: this.toneFor(name),
    }));
  });

  readonly tagEntries = computed<TagEntry[]>(() => {
    const counts = new Map<string, number>();
    for (const note of this.activeNotes()) {
      for (const tag of note.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, count]) => ({ tag, count }));
  });

  readonly viewTitle = computed(() => {
    const view = this.activeView();
    switch (view) {
      case 'all':
        return 'All Notes';
      case 'unfiled':
        return 'Unfiled Notes';
      case 'pinned':
        return 'Pinned Notes';
      case 'sensitive':
        return 'Sensitive Vault';
      case 'trash':
        return 'Trash';
      default:
        return view.slice(FOLDER_PREFIX.length);
    }
  });

  readonly filteredNotes = computed(() => {
    const view = this.activeView();
    const folder = this.activeFolderName();
    const tag = this.activeTag();
    const query = this.searchQuery().toLowerCase().trim();
    const sortBy = this.sortBy();

    return this.notes()
      .filter((note) => {
        if (view === 'trash') {
          if (!note.trashed) return false;
        } else {
          if (note.trashed) return false;
          if (view === 'unfiled' && note.folder) return false;
          if (view === 'pinned' && !note.pinned) return false;
          if (view === 'sensitive' && !note.sensitive) return false;
          if (folder !== null && note.folder !== folder) return false;
        }

        if (tag && !(note.tags ?? []).includes(tag)) return false;

        if (query) {
          const bareQuery = query.replace('#', '');
          const inTitle = (note.title || '').toLowerCase().includes(query);
          const folderLabel = note.folder ? note.folder.toLowerCase() : 'unfiled no folder';
          const inFolder = folderLabel.includes(query);
          const inTags = (note.tags ?? []).some((t) => t.toLowerCase().includes(bareQuery));
          // Sensitive note bodies are never searched, so they can't leak through results.
          const inContent = !note.sensitive && (note.content || '').toLowerCase().includes(query);
          if (!inTitle && !inFolder && !inTags && !inContent) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (view !== 'trash') {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
        }
        switch (sortBy) {
          case 'created':
            return b.createdAt - a.createdAt;
          case 'alpha':
            return (a.title || 'Untitled').localeCompare(b.title || 'Untitled');
          default:
            return b.updatedAt - a.updatedAt;
        }
      });
  });

  readonly selectedNote = computed(() => this.findNote(this.selectedNoteId()));
  readonly detailNote = computed(() => this.findNote(this.detailNoteId()));

  private isFirstPersist = true;
  private savingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Persist whenever notes or folders change.
    effect(() => {
      writeStorage(STORAGE_KEY_NOTES, this.notes());
      writeStorage(STORAGE_KEY_FOLDERS, this.folders());
      writeStorage(STORAGE_KEY_FOLDER_COLORS, this.folderColors());
      if (this.isFirstPersist) {
        this.isFirstPersist = false;
        return;
      }
      this.flashSaving();
    });
  }

  // ---- Helpers ------------------------------------------------------------
  toneFor(folder: string | null): FolderTone {
    if (!folder) {
      return UNFILED_TONE;
    }
    const chosen = this.folderColors()[folder];
    if (chosen) {
      const option = FOLDER_TONES.find((t) => t.key === chosen);
      if (option) {
        return option;
      }
    }
    const index = this.folders().indexOf(folder);
    if (index >= 0) {
      return FOLDER_TONES[index % FOLDER_TONES.length];
    }
    let hash = 0;
    for (let i = 0; i < folder.length; i++) {
      hash = folder.charCodeAt(i) + ((hash << 5) - hash);
    }
    return FOLDER_TONES[Math.abs(hash) % FOLDER_TONES.length];
  }

  isUnlocked(id: string): boolean {
    return this.unlockedNoteIds().has(id);
  }

  // ---- Navigation / filters ----------------------------------------------
  setView(view: ActiveView): void {
    this.activeView.set(view);
    this.detailNoteId.set(null);
  }

  toggleTag(tag: string): void {
    this.activeTag.update((current) => (current === tag ? null : tag));
    this.detailNoteId.set(null);
  }

  clearTag(): void {
    this.activeTag.set(null);
  }

  setSearch(query: string): void {
    this.searchQuery.set(query);
  }

  setSort(value: string): void {
    if (value === 'updated' || value === 'created' || value === 'alpha') {
      this.sortBy.set(value);
    }
  }

  togglePrivacyShield(): void {
    this.privacyShieldOn.update((on) => !on);
  }

  setSidebarOpen(open: boolean): void {
    this.sidebarOpen.set(open);
  }

  setEditorMode(mode: EditorMode): void {
    this.editorMode.set(mode);
  }

  toggleFocusMode(): void {
    this.focusMode.update((on) => !on);
  }

  // ---- Selection / studio -------------------------------------------------
  selectNote(id: string): void {
    this.selectedNoteId.set(id);
  }

  clearSelection(): void {
    this.selectedNoteId.set(null);
  }

  openStudio(id: string): void {
    this.selectedNoteId.set(id);
    this.detailNoteId.set(id);
  }

  closeStudio(): void {
    this.detailNoteId.set(null);
    this.focusMode.set(false);
  }

  handleEscape(): void {
    if (this.detailNoteId()) {
      this.closeStudio();
    } else if (this.selectedNoteId()) {
      this.clearSelection();
    }
  }

  unlockNote(id: string): void {
    this.unlockedNoteIds.update((ids) => new Set(ids).add(id));
  }

  // ---- Note CRUD ----------------------------------------------------------
  /** Creates a note and opens it in the studio. Unfiled unless a folder view is active. */
  createNote(): void {
    const folder = this.activeFolderName();
    if (this.activeView() === 'trash') {
      this.activeView.set('all');
    }
    const view = this.activeView();
    const tag = this.activeTag();
    const now = Date.now();

    const note: Note = {
      id: newId(),
      title: 'Untitled Note',
      folder,
      tags: tag ? [tag] : [],
      pinned: view === 'pinned',
      sensitive: view === 'sensitive',
      trashed: false,
      createdAt: now,
      updatedAt: now,
      content:
        '# Untitled Note\n\nStart writing calmly here... (This note works without needing a folder).\n\n- [ ] First action item',
    };

    this.notes.update((list) => [note, ...list]);
    this.unlockNote(note.id);
    this.openStudio(note.id);
    this.pendingTitleFocusId.set(note.id);
  }

  /** Creates a note from just a title. Returns `false` when the title is blank. */
  quickCapture(title: string, folder: string | null): boolean {
    const rawTitle = title.trim();
    if (!rawTitle) {
      return false;
    }
    const view = this.activeView();
    const tag = this.activeTag();
    const now = Date.now();

    const note: Note = {
      id: newId(),
      title: rawTitle,
      folder: folder || null,
      tags: tag ? [tag] : [],
      pinned: view === 'pinned',
      sensitive: view === 'sensitive',
      trashed: false,
      createdAt: now,
      updatedAt: now,
      content: `# ${rawTitle}\n\n`,
    };

    this.notes.update((list) => [note, ...list]);
    this.selectedNoteId.set(note.id);
    return true;
  }

  updateNote(id: string, patch: NotePatch): void {
    const updatedAt = Date.now();
    this.notes.update((list) => list.map((n) => (n.id === id ? { ...n, ...patch, updatedAt } : n)));
  }

  setTitle(id: string, title: string): void {
    this.updateNote(id, { title });
  }

  setBody(id: string, content: string): void {
    this.updateNote(id, { content });
  }

  setFolder(id: string, folder: string | null): void {
    this.updateNote(id, { folder: folder || null });
  }

  togglePin(id: string): void {
    const note = this.findNote(id);
    if (note) this.updateNote(id, { pinned: !note.pinned });
  }

  toggleSensitive(id: string): void {
    const note = this.findNote(id);
    if (!note) return;
    const sensitive = !note.sensitive;
    if (!sensitive) {
      this.unlockedNoteIds.update((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    } else if (this.detailNoteId() === id) {
      // Marking the note you're editing as sensitive shouldn't lock you out of it immediately.
      this.unlockNote(id);
    }
    this.updateNote(id, { sensitive });
  }

  addTag(id: string, rawTag: string): void {
    const tag = rawTag.trim().toLowerCase().replace(/^#/, '');
    const note = this.findNote(id);
    if (!tag || !note || note.tags.includes(tag)) return;
    this.updateNote(id, { tags: [...note.tags, tag] });
  }

  removeTag(id: string, tag: string): void {
    const note = this.findNote(id);
    if (note) this.updateNote(id, { tags: note.tags.filter((t) => t !== tag) });
  }

  toggleTask(id: string, lineIdx: number, checked: boolean): void {
    const note = this.findNote(id);
    if (!note) return;
    const content = toggleTaskLine(note.content, lineIdx, checked);
    if (content !== note.content) this.updateNote(id, { content });
  }

  duplicateNote(id: string): void {
    const note = this.findNote(id);
    if (!note) return;
    const now = Date.now();
    const copy: Note = {
      ...note,
      id: newId(),
      title: `${note.title || 'Untitled'} (Copy)`,
      tags: [...note.tags],
      createdAt: now,
      updatedAt: now,
    };
    this.notes.update((list) => [copy, ...list]);
    this.selectedNoteId.set(copy.id);
  }

  /** Moves a note to Trash; a note already in Trash is deleted permanently. */
  trashOrDeleteNote(id: string): void {
    const note = this.findNote(id);
    if (!note) return;
    if (note.trashed) {
      this.notes.update((list) => list.filter((n) => n.id !== id));
    } else {
      this.updateNote(id, { trashed: true, pinned: false });
    }
    this.selectedNoteId.set(null);
    this.detailNoteId.set(null);
  }

  restoreNote(id: string): void {
    this.updateNote(id, { trashed: false });
  }

  // ---- Folders ------------------------------------------------------------
  /** Adds a folder. `color` of `null` means "Auto" (the default). */
  addFolder(rawName: string, color: FolderColorKey | null = null): void {
    const name = rawName.trim();
    if (name && !this.folders().includes(name)) {
      this.folders.update((list) => [...list, name]);
      if (color) {
        this.folderColors.update((colors) => ({ ...colors, [name]: color }));
      }
    }
  }

  /** Deleting a folder never deletes notes — they move back to Unfiled. */
  deleteFolder(name: string): void {
    this.notes.update((list) => list.map((n) => (n.folder === name ? { ...n, folder: null } : n)));
    this.folders.update((list) => list.filter((f) => f !== name));
    this.folderColors.update((colors) => {
      const next = { ...colors };
      delete next[name];
      return next;
    });
    if (this.activeFolderName() === name) {
      this.activeView.set('unfiled');
    }
  }

  // ---- Trash --------------------------------------------------------------
  /** Permanently removes everything in Trash. */
  emptyTrash(): void {
    const trashedIds = new Set(this.notes().filter((n) => n.trashed).map((n) => n.id));
    if (trashedIds.size === 0) {
      return;
    }
    this.notes.update((list) => list.filter((n) => !n.trashed));
    const selected = this.selectedNoteId();
    if (selected && trashedIds.has(selected)) this.selectedNoteId.set(null);
    const detail = this.detailNoteId();
    if (detail && trashedIds.has(detail)) this.detailNoteId.set(null);
  }

  // ---- Confirmed (user-facing) deletes ------------------------------------
  /** Asks first, then trashes the note (or deletes it permanently if it's already in Trash). */
  async requestDeleteNote(id: string): Promise<void> {
    const note = this.findNote(id);
    if (!note) return;
    const name = note.title || 'Untitled Note';

    const confirmed = await this.confirm.ask(
      note.trashed
        ? {
            title: 'Delete note permanently?',
            message: `"${name}" will be deleted forever. This can't be undone.`,
            confirmLabel: 'Delete permanently',
          }
        : {
            title: 'Move note to Trash?',
            message: `"${name}" will be moved to Trash. You can restore it from there.`,
            confirmLabel: 'Move to Trash',
          },
    );
    if (confirmed) this.trashOrDeleteNote(id);
  }

  async requestEmptyTrash(): Promise<void> {
    const count = this.counts().trash;
    if (count === 0) return;
    const confirmed = await this.confirm.ask({
      title: 'Empty Trash?',
      message: `${count} ${count === 1 ? 'note' : 'notes'} will be deleted forever. This can't be undone.`,
      confirmLabel: 'Empty Trash',
    });
    if (confirmed) this.emptyTrash();
  }

  async requestDeleteFolder(name: string): Promise<void> {
    const count = this.notes().filter((n) => n.folder === name).length;
    const outcome =
      count === 0
        ? 'It has no notes.'
        : `Its ${count} ${count === 1 ? 'note' : 'notes'} will move to Unfiled — no notes are deleted.`;
    const confirmed = await this.confirm.ask({
      title: `Delete folder "${name}"?`,
      message: `The folder will be removed. ${outcome}`,
      confirmLabel: 'Delete folder',
    });
    if (confirmed) this.deleteFolder(name);
  }

  // ---- Internals ----------------------------------------------------------
  private findNote(id: string | null): Note | null {
    return id ? (this.notes().find((n) => n.id === id) ?? null) : null;
  }

  private flashSaving(): void {
    this.saving.set(true);
    if (this.savingTimer) clearTimeout(this.savingTimer);
    this.savingTimer = setTimeout(() => this.saving.set(false), 350);
  }

  private loadNotes(): Note[] {
    const saved = readStorage<Note[]>(STORAGE_KEY_NOTES);
    return Array.isArray(saved) ? saved : createDefaultNotes();
  }

  private loadFolderColors(): Record<string, FolderColorKey> {
    const saved = readStorage<Record<string, FolderColorKey>>(STORAGE_KEY_FOLDER_COLORS);
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  }

  private loadFolders(): string[] {
    const saved = readStorage<string[]>(STORAGE_KEY_FOLDERS);
    return Array.isArray(saved) ? saved : [...DEFAULT_FOLDERS];
  }
}
