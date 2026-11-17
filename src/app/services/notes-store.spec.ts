import { TestBed } from '@angular/core/testing';
import { NotesStore } from './notes-store';
import { ConfirmService } from './confirm.service';

describe('NotesStore', () => {
  let store: NotesStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(NotesStore);
  });

  it('seeds the default notes and counts', () => {
    expect(store.notes().length).toBe(6);
    expect(store.counts().all).toBe(6);
    expect(store.counts().unfiled).toBe(3);
    expect(store.counts().pinned).toBe(2);
    expect(store.counts().sensitive).toBe(2);
  });

  it('creates unfiled notes by default and opens them in the studio', () => {
    store.createNote();
    const note = store.detailNote();
    expect(note).toBeTruthy();
    expect(note?.folder).toBeNull();
    expect(store.counts().unfiled).toBe(4);
  });

  it('creates notes inside the folder currently being browsed', () => {
    store.setView('folder:Work & Projects');
    store.createNote();
    expect(store.detailNote()?.folder).toBe('Work & Projects');
  });

  it('moves notes to Unfiled when their folder is deleted', () => {
    store.deleteFolder('Work & Projects');
    expect(store.folders()).not.toContain('Work & Projects');
    expect(store.notes().find((n) => n.id === 'note-4')?.folder).toBeNull();
  });

  it('trashes a note first, then deletes it permanently', () => {
    store.trashOrDeleteNote('note-2');
    expect(store.notes().find((n) => n.id === 'note-2')?.trashed).toBe(true);
    expect(store.counts().trash).toBe(1);

    store.trashOrDeleteNote('note-2');
    expect(store.notes().find((n) => n.id === 'note-2')).toBeUndefined();
  });

  it('never searches the body of sensitive notes', () => {
    store.setSearch('rotate');
    expect(store.filteredNotes().length).toBe(0);

    store.setSearch('sourdough');
    expect(store.filteredNotes().map((n) => n.id)).toEqual(['note-2']);
  });

  it('toggles a checklist line', () => {
    store.toggleTask('note-2', 5, false); // "- [x] Sourdough country loaf"
    const line = store.notes().find((n) => n.id === 'note-2')?.content.split('\n')[5];
    expect(line).toContain('[ ]');
  });

  it('asks before trashing a note and respects "cancel"', async () => {
    const confirm = TestBed.inject(ConfirmService);

    const cancelled = store.requestDeleteNote('note-2');
    expect(confirm.request()?.title).toContain('Trash');
    confirm.answer(false);
    await cancelled;
    expect(store.notes().find((n) => n.id === 'note-2')?.trashed).toBe(false);

    const accepted = store.requestDeleteNote('note-2');
    confirm.answer(true);
    await accepted;
    expect(store.notes().find((n) => n.id === 'note-2')?.trashed).toBe(true);
  });

  it('empties the trash only after confirmation', async () => {
    const confirm = TestBed.inject(ConfirmService);
    store.trashOrDeleteNote('note-1');
    store.trashOrDeleteNote('note-2');
    expect(store.counts().trash).toBe(2);

    const declined = store.requestEmptyTrash();
    confirm.answer(false);
    await declined;
    expect(store.counts().trash).toBe(2);

    const accepted = store.requestEmptyTrash();
    confirm.answer(true);
    await accepted;
    expect(store.counts().trash).toBe(0);
    expect(store.notes().length).toBe(4);
  });

  it('asks before deleting a folder', async () => {
    const confirm = TestBed.inject(ConfirmService);
    const pending = store.requestDeleteFolder('Reading & Ideas');
    expect(confirm.request()?.message).toContain('1 note');
    confirm.answer(true);
    await pending;
    expect(store.folders()).not.toContain('Reading & Ideas');
  });

  it('uses an automatic folder color by default and honors a chosen one', () => {
    store.addFolder('Auto Folder');
    store.addFolder('Sky Folder', 'sky');

    expect(store.folderColors()['Auto Folder']).toBeUndefined();
    // Auto = palette by position: the 4th folder (index 3) gets the 4th color, rose.
    expect(store.toneFor('Auto Folder').cls).toBe('folder-tone-rose');
    expect(store.toneFor('Sky Folder').cls).toBe('folder-tone-sky');

    store.deleteFolder('Sky Folder');
    expect(store.folderColors()['Sky Folder']).toBeUndefined();
  });
});
