import { Component, inject, linkedSignal } from '@angular/core';
import { NotesStore } from '../../services/notes-store';
import { FolderSelect } from '../folder-select/folder-select';

/** One-keystroke note creation — unfiled by default, or into the folder you're browsing. */
@Component({
  selector: 'app-quick-capture',
  imports: [FolderSelect],
  templateUrl: './quick-capture.html',
  host: {
    class: 'd-block',
    // Don't let clicks here bubble to the grid area and deselect the current card.
    '(click)': '$event.stopPropagation()',
  },
})
export class QuickCapture {
  private readonly store = inject(NotesStore);

  /** Follows the folder being browsed, but can be overridden with the dropdown. */
  protected readonly folder = linkedSignal<string | null>(() => this.store.activeFolderName());

  protected save(input: HTMLInputElement): void {
    if (this.store.quickCapture(input.value, this.folder())) {
      input.value = '';
    }
  }
}
