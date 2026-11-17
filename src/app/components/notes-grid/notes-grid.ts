import { Component, inject } from '@angular/core';
import { NotesStore } from '../../services/notes-store';
import { NoteCard } from '../note-card/note-card';

@Component({
  selector: 'app-notes-grid',
  imports: [NoteCard],
  templateUrl: './notes-grid.html',
  host: { class: 'notes-grid' },
})
export class NotesGrid {
  protected readonly store = inject(NotesStore);
}
