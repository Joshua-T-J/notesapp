import { Component, computed, inject, linkedSignal } from '@angular/core';
import { Note } from '../../models/note.model';
import { NotesStore } from '../../services/notes-store';
import { FolderSelect } from '../folder-select/folder-select';

/** Floating actions for the card selected with a single click. */
@Component({
  selector: 'app-quick-action-dock',
  imports: [FolderSelect],
  templateUrl: './quick-action-dock.html',
})
export class QuickActionDock {
  protected readonly store = inject(NotesStore);

  protected readonly visible = computed(
    () => this.store.selectedNote() !== null && this.store.detailNoteId() === null,
  );

  /** Keeps showing the last selected note while the dock slides out, so it doesn't go blank. */
  protected readonly note = linkedSignal<Note | null, Note | null>({
    source: this.store.selectedNote,
    computation: (current, previous) => current ?? previous?.value ?? null,
  });
}
