import { Component, computed, inject, input, output } from '@angular/core';
import { NotesStore } from '../../services/notes-store';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';

/** Folder picker shared by quick-capture, the action dock and the studio. `null` = Unfiled. */
@Component({
  selector: 'app-folder-select',
  imports: [Dropdown],
  template: `
    <app-dropdown
      [options]="options()"
      [value]="value() ?? ''"
      [label]="label()"
      [compact]="small()"
      [placement]="placement()"
      (valueChange)="valueChange.emit($event || null)"
    />
  `,
  host: { class: 'd-inline-block' },
})
export class FolderSelect {
  private readonly store = inject(NotesStore);

  readonly value = input<string | null>(null);
  readonly label = input('Assign folder or keep unfiled');
  readonly small = input(false);
  readonly placement = input<'down' | 'up'>('down');
  readonly valueChange = output<string | null>();

  protected readonly options = computed<DropdownOption[]>(() => [
    { value: '', label: 'No Folder (Unfiled)', icon: 'bi-file-earmark-text' },
    ...this.store.folders().map((folder) => ({
      value: folder,
      label: folder,
      color: this.store.toneFor(folder).hex,
    })),
  ]);
}
