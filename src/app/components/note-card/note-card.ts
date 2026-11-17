import { Component, computed, inject, input, output } from '@angular/core';
import { Note } from '../../models/note.model';
import { NotesStore } from '../../services/notes-store';
import { formatRelativeTime, getNoteMetrics, toPlainSnippet } from '../../utils/note-helpers';

/**
 * A single card in the notes grid. The host element *is* the card, so the
 * global `.note-card` styles (including the `::before` accent bar) apply directly.
 * Single-click selects, double-click / Enter opens.
 */
@Component({
  selector: 'app-note-card',
  templateUrl: './note-card.html',
  styleUrl: './note-card.scss',
  host: {
    class: 'note-card',
    role: 'button',
    tabindex: '0',
    '[class.selected]': 'selected()',
    '[class.is-pinned]': 'note().pinned',
    '[attr.aria-pressed]': 'selected()',
    '[attr.aria-label]': 'ariaLabel()',
    '[style.--card-accent]': 'tone().hex',
    '(click)': 'onClick($event)',
    '(dblclick)': 'onDoubleClick($event)',
    '(keydown.enter)': 'openNote.emit()',
    '(keydown.space)': 'onSpace($event)',
  },
})
export class NoteCard {
  private readonly store = inject(NotesStore);

  readonly note = input.required<Note>();
  readonly selected = input(false);
  readonly shieldOn = input(true);

  readonly selectNote = output<void>();
  readonly openNote = output<void>();

  protected readonly unfiled = computed(() => !this.note().folder);
  protected readonly tone = computed(() => this.store.toneFor(this.note().folder));
  protected readonly metrics = computed(() => getNoteMetrics(this.note().content));
  protected readonly progressPct = computed(() => {
    const { totalTasks, doneTasks } = this.metrics();
    return totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  });
  protected readonly visibleTags = computed(() => (this.note().tags ?? []).slice(0, 3));
  protected readonly snippet = computed(() => toPlainSnippet(this.note().content));
  protected readonly updatedLabel = computed(() => formatRelativeTime(this.note().updatedAt));
  protected readonly ariaLabel = computed(() => {
    const note = this.note();
    const title = note.title || 'Untitled Note';
    return note.sensitive ? `${title} (sensitive note)` : title;
  });

  protected onClick(event: Event): void {
    event.stopPropagation();
    this.selectNote.emit();
  }

  protected onDoubleClick(event: Event): void {
    event.stopPropagation();
    this.openNote.emit();
  }

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.selectNote.emit();
  }
}
