import { LEGACY_KEYS } from './legacy-migration';
import { LocalStorageNotesRepository, WORKSPACE_KEY } from './local-notes.repository';

describe('LocalStorageNotesRepository', () => {
  let repo: LocalStorageNotesRepository;
  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageNotesRepository();
  });

  it('seeds welcome notes on first run', async () => {
    const { workspace, source } = await repo.load();
    expect(source).toBe('new');
    expect(workspace.notes.length).toBeGreaterThan(0);
  });

  it('saves and loads a workspace', async () => {
    const { workspace } = await repo.load();
    workspace.notes[0]!.title = 'Changed';
    await repo.save(workspace);
    const again = await repo.load();
    expect(again.source).toBe('stored');
    expect(again.workspace.notes[0]?.title).toBe('Changed');
  });

  it('keeps a copy of unreadable data instead of overwriting it', async () => {
    localStorage.setItem(WORKSPACE_KEY, '{"version":2,"notes":"nope"}');
    const { workspace, source } = await repo.load();
    expect(source).toBe('recovered');
    expect(workspace.notes).toEqual([]);
    expect(localStorage.getItem(`${WORKSPACE_KEY}.unreadable`)).toContain('nope');
  });

  it('migrates v1 Markdown notes and removes the old keys', async () => {
    localStorage.setItem(
      LEGACY_KEYS.notes,
      JSON.stringify([
        {
          id: 'n1',
          title: 'Plan',
          folder: 'Work',
          tags: ['a'],
          pinned: true,
          sensitive: true,
          trashed: false,
          createdAt: 1,
          updatedAt: 2,
          content: '# Plan\n- [x] Done\nHello **there**',
        },
      ]),
    );
    localStorage.setItem(LEGACY_KEYS.folders, JSON.stringify(['Work']));
    localStorage.setItem(LEGACY_KEYS.folderColors, JSON.stringify({ Work: 'rose' }));

    const { workspace, source } = await repo.load();
    expect(source).toBe('migrated');
    const note = workspace.notes[0]!;
    expect(note.locked).toBe(true);
    expect(note.folderId).toBe(workspace.folders[0]?.id);
    expect(workspace.folders[0]).toMatchObject({ name: 'Work', color: 3 });
    expect(note.body.map((b) => b.type)).toEqual(['todo', 'p']);
    expect(localStorage.getItem(LEGACY_KEYS.notes)).toBeNull();
  });

  it('clear() leaves an empty workspace so welcome notes do not come back', async () => {
    await repo.load();
    await repo.clear();
    const { workspace, source } = await repo.load();
    expect(source).toBe('stored');
    expect(workspace.notes).toEqual([]);
  });
});
