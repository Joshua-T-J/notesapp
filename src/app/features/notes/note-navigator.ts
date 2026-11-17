import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotesStore } from '../../core/notes/notes.store';

/** Shared "new note" behaviour: create it with the current filters, open it, focus the title. */
@Injectable()
export class NoteNavigator {
  private readonly store = inject(NotesStore);
  private readonly router = inject(Router);

  createAndOpen(): void {
    const id = this.store.createNote();
    void this.router.navigate(['/app/note', id], { state: { focusTitle: true } });
  }

  close(): void {
    void this.router.navigate(['/app']);
  }
}
