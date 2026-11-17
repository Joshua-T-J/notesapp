import { TestBed } from '@angular/core/testing';
import { Note, Workspace, WORKSPACE_VERSION, emptyWorkspace } from './note.model';
import { LoadResult, NotesRepository } from './notes.repository';
import { NotesStore } from './notes.store';

class MemoryRepository extends NotesRepository {
  saved: Workspace | null = null;
  constructor(private readonly initial: Workspace) {
    super();
  }
  override async load(): Promise<LoadResult> {
    return { workspace: structuredClone(this.initial), source: 'stored' };
  }
  override async save(ws: Workspace): Promise<void> {
    this.saved = structuredClone(ws);
  }
  override async clear(): Promise<void> {
    this.saved = emptyWorkspace();
  }
  override async usage(): Promise<number | null> {
    return null;
  }
}

function note(id: string, patch: Partial<Note> = {}): Note {
  return {
    id,
    title: id,
    folderId: null,
    tags: [],
    pinned: false,
    locked: false,
    trashedAt: null,
    createdAt: 1,
    updatedAt: 1,
    body: [],
    ...patch,
  };
}

async function setup(
  ws: Partial<Workspace> = {},
): Promise<{ store: NotesStore; repo: MemoryRepository }> {
  const repo = new MemoryRepository({ version: WORKSPACE_VERSION, notes: [], folders: [], ...ws });
  TestBed.configureTestingModule({
    providers: [NotesStore, { provide: NotesRepository, useValue: repo }],
  });
  const store = TestBed.inject(NotesStore);
  await vi.waitFor(() => expect(store.loaded()).toBe(true));
  return { store, repo };
}

describe('NotesStore', () => {
  it('creates notes in the folder being browsed', async () => {
    const { store } = await setup();
    const folderId = store.addFolder('Work')!;
    store.setView({ kind: 'folder', folderId });
    const id = store.createNote();
    expect(store.notes().find((n) => n.id === id)?.folderId).toBe(folderId);
  });

  it('new notes inherit the active tag, pinned and locked views', async () => {
    const { store } = await setup();
    store.toggleTag('books');
    store.setView({ kind: 'pinned' });
    const pinnedId = store.createNote();
    const pinned = store.notes().find((n) => n.id === pinnedId);
    expect(pinned).toMatchObject({ pinned: true, tags: ['books'] });
    expect(store.newNoteContext().label).toBe('pinned, tagged #books');

    store.setView({ kind: 'locked' });
    const locked = store.createNote();
    expect(store.notes().find((n) => n.id === locked)?.locked).toBe(true);
    expect(store.unlocked().has(locked)).toBe(true);
    expect(store.listNotes().some((n) => n.id === locked)).toBe(true);
  });

  it('uses a chosen folder colour, or an unused one for random', async () => {
    const { store } = await setup();
    const a = store.addFolder('A', 7)!;
    expect(store.folderById().get(a)?.color).toBe(7);
    const b = store.addFolder('B')!;
    expect(store.folderById().get(b)?.color).not.toBe(7);
    store.setFolderColor(a, 2);
    expect(store.folderById().get(a)?.color).toBe(2);
  });

  it('does not create duplicate folders', async () => {
    const { store } = await setup();
    const a = store.addFolder('Work');
    const b = store.addFolder('  work ');
    expect(a).toBe(b);
    expect(store.folders().length).toBe(1);
  });

  it('keeps notes when their folder is deleted', async () => {
    const { store } = await setup();
    const folderId = store.addFolder('Work')!;
    const id = store.createNote();
    store.setFolder(id, folderId);
    store.deleteFolder(folderId);
    expect(store.notes().find((n) => n.id === id)?.folderId).toBeNull();
  });

  it('moves to Trash, restores and deletes permanently', async () => {
    const { store } = await setup({ notes: [note('a'), note('b')] });
    store.trash('a');
    expect(store.counts()).toMatchObject({ all: 1, trash: 1 });
    store.restore('a');
    expect(store.counts().trash).toBe(0);
    store.trash('a');
    store.emptyTrash();
    expect(store.notes().map((n) => n.id)).toEqual(['b']);
  });

  it('lists pinned notes first', async () => {
    const { store } = await setup({
      notes: [note('old', { updatedAt: 1, pinned: true }), note('new', { updatedAt: 5 })],
    });
    expect(store.listNotes().map((n) => n.id)).toEqual(['old', 'new']);
  });

  it('never searches the text of locked notes', async () => {
    const body = [{ type: 'p' as const, spans: [{ text: 'secret pin 1234' }] }];
    const { store } = await setup({
      notes: [note('a', { locked: true, body }), note('b', { body })],
    });
    store.search.set('1234');
    expect(store.listNotes().map((n) => n.id)).toEqual(['b']);
  });

  it('normalises tags', async () => {
    const { store } = await setup({ notes: [note('a')] });
    store.addTag('a', '#Reading List');
    store.addTag('a', 'reading-list');
    expect(store.notes()[0]?.tags).toEqual(['reading-list']);
  });

  it('imports a backup, keeping the newer copy of each note', async () => {
    const { store } = await setup({
      notes: [
        note('a', { title: 'mine', updatedAt: 10 }),
        note('b', { title: 'old', updatedAt: 1 }),
      ],
    });
    const result = store.importWorkspace({
      version: WORKSPACE_VERSION,
      folders: [],
      notes: [
        note('a', { title: 'older', updatedAt: 5 }),
        note('b', { title: 'newer', updatedAt: 9 }),
        note('c'),
      ],
    });
    expect(result.notes).toBe(2);
    const titles = Object.fromEntries(store.notes().map((n) => [n.id, n.title]));
    expect(titles).toEqual({ a: 'mine', b: 'newer', c: 'c' });
  });

  it('saves changes through the repository', async () => {
    const { store, repo } = await setup();
    store.createNote();
    await vi.waitFor(() => expect(repo.saved?.notes.length).toBe(1), { timeout: 2000 });
    expect(store.saveState()).toBe('saved');
  });

  it('delete everything clears the repository and the view', async () => {
    const { store, repo } = await setup({ notes: [note('a')] });
    await store.deleteEverything();
    expect(store.notes()).toEqual([]);
    expect(repo.saved).toEqual(emptyWorkspace());
  });
});
