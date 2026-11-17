import { Component, inject } from '@angular/core';
import { NotesStore } from '../../services/notes-store';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';

/** Top bar above the card grid: view title, search, privacy shield, sort and "New Note". */
@Component({
  selector: 'app-notes-toolbar',
  imports: [Dropdown],
  templateUrl: './notes-toolbar.html',
  host: { class: 'd-block' },
})
export class NotesToolbar {
  protected readonly store = inject(NotesStore);

  protected readonly sortOptions: readonly DropdownOption[] = [
    { value: 'updated', label: 'Recently Edited' },
    { value: 'created', label: 'Date Created' },
    { value: 'alpha', label: 'Title (A–Z)' },
  ];

  protected clearSearch(input: HTMLInputElement): void {
    this.store.setSearch('');
    input.focus();
  }
}
