import { Component, computed, inject } from '@angular/core';
import { NotesStore } from './services/notes-store';
import { ConfirmService } from './services/confirm.service';
import { ConfirmDialog } from './components/confirm-dialog/confirm-dialog';
import { ThemeService } from './services/theme.service';
import { NotesGrid } from './components/notes-grid/notes-grid';
import { NotesToolbar } from './components/notes-toolbar/notes-toolbar';
import { NoteStudio } from './components/note-studio/note-studio';
import { QuickActionDock } from './components/quick-action-dock/quick-action-dock';
import { QuickCapture } from './components/quick-capture/quick-capture';
import { ReferenceModal } from './components/reference-modal/reference-modal';
import { Sidebar } from './components/sidebar/sidebar';

@Component({
  selector: 'app-root',
  imports: [
    Sidebar,
    NotesToolbar,
    QuickCapture,
    NotesGrid,
    QuickActionDock,
    NoteStudio,
    ReferenceModal,
    ConfirmDialog,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '(window:keydown.escape)': 'onEscape()',
  },
})
export class App {
  protected readonly store = inject(NotesStore);
  private readonly confirm = inject(ConfirmService);
  // Injected eagerly so the saved theme is applied before the first render.
  private readonly theme = inject(ThemeService);

  /** While the studio overlay is open, the views underneath are inert (no tab stops / clicks). */
  protected readonly studioOpen = computed(() => this.store.detailNoteId() !== null);

  protected onEscape(): void {
    // Esc belongs to the confirm dialog while one is open; don't also close the studio behind it.
    if (this.confirm.request() === null) {
      this.store.handleEscape();
    }
  }
}
