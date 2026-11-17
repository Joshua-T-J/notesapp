import { Component, computed, inject } from '@angular/core';
import { NotesStore } from '../../core/notes/notes.store';
import { Icon } from '../../shared/ui/icon';
import { NoteNavigator } from './note-navigator';

/** Editor pane when no note is open. */
@Component({
  selector: 'app-no-note',
  imports: [Icon],
  template: `
    <div class="empty">
      @if (store.loaded()) {
        @if (store.isTrashView()) {
          <h2>Trash</h2>
          <p>Select a note to restore it or delete it permanently.</p>
        } @else {
          <h2>{{ heading() }}</h2>
          <p>{{ text() }}</p>
          <button type="button" class="btn btn-primary" (click)="navigator.createAndOpen()">
            <app-icon name="plus" [size]="17" />
            New note
          </button>
          @if (store.newNoteContext().label; as label) {
            <p class="context">It will be {{ label }}, matching what you’re viewing.</p>
          }
          <p class="tip">
            <span class="tip-label">Tip</span> Press <kbd>N</kbd> anywhere to start a note, and
            <kbd>/</kbd> to search.
          </p>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      height: 100%;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 460px;
      padding: 24px;
      text-align: center;
    }
    h2 {
      margin: 0 0 6px;
      font-size: 19px;
      font-weight: 600;
    }
    p {
      margin: 0;
      color: var(--ink-2);
      font-size: 14.5px;
    }
    .btn {
      margin-top: 18px;
    }
    .context {
      margin-top: 10px;
      color: var(--ink-3);
      font-size: 13px;
    }
    .tip {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 4px;
      margin-top: 28px;
      padding: 8px 12px;
      border-radius: 10px;
      background: var(--surface-2);
      color: var(--ink-2);
      font-size: 13px;
    }
    .tip-label {
      margin-right: 4px;
      color: var(--ink);
      font-weight: 600;
    }
    kbd {
      padding: 0 6px;
      border: 1px solid var(--border-strong);
      border-radius: 5px;
      background: var(--surface);
      font: 500 12px var(--font-body);
    }
  `,
})
export class NoNote {
  protected readonly store = inject(NotesStore);
  protected readonly navigator = inject(NoteNavigator);

  protected readonly heading = computed(() =>
    this.store.counts().all === 0 ? 'No notes yet' : 'No note selected',
  );
  protected readonly text = computed(() =>
    this.store.counts().all === 0
      ? 'Your notes are saved in this browser as you type.'
      : 'Pick a note from the list, or start a new one.',
  );
}
