import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FOLDER_TONES } from '../../data/folder-colors';
import { FolderColorKey, QuickView } from '../../models/note.model';
import { NotesStore } from '../../services/notes-store';
import { ThemeService } from '../../services/theme.service';

interface QuickViewItem {
  view: QuickView;
  label: string;
  icon: string;
  iconColor: string | null;
}

/** Left pane: quick views, optional folders, tag filters and the theme switcher. */
@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly store = inject(NotesStore);
  protected readonly themeService = inject(ThemeService);

  protected readonly quickViews: readonly QuickViewItem[] = [
    { view: 'all', label: 'All Notes', icon: 'bi-grid-1x2', iconColor: null },
    { view: 'unfiled', label: 'Unfiled Notes', icon: 'bi-file-earmark-text', iconColor: null },
    { view: 'pinned', label: 'Pinned', icon: 'bi-pin-angle', iconColor: 'var(--warm-highlight)' },
    { view: 'sensitive', label: 'Sensitive Vault', icon: 'bi-shield-lock', iconColor: 'var(--accent)' },
    { view: 'trash', label: 'Trash', icon: 'bi-trash3', iconColor: null },
  ];

  protected readonly showFolderForm = signal(false);
  protected readonly colorOptions = FOLDER_TONES;
  /** `null` = "Auto" (default): the folder takes the next color in the palette. */
  protected readonly newFolderColor = signal<FolderColorKey | null>(null);
  private readonly folderInput = viewChild<ElementRef<HTMLInputElement>>('folderInput');

  protected toggleFolderForm(): void {
    this.showFolderForm.update((open) => !open);
    if (this.showFolderForm()) {
      setTimeout(() => this.folderInput()?.nativeElement.focus());
    }
  }

  protected addFolder(input: HTMLInputElement): void {
    this.store.addFolder(input.value, this.newFolderColor());
    input.value = '';
    this.newFolderColor.set(null);
    this.showFolderForm.set(false);
  }
}
