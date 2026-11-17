import { Component, ElementRef, computed, inject, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmService } from '../../../core/feedback/confirm.service';
import { firstLine } from '../../../core/content/blocks';
import { Note, SortBy } from '../../../core/notes/note.model';
import { NotesStore } from '../../../core/notes/notes.store';
import { SettingsStore } from '../../../core/settings/settings.store';
import { formatListDate, plural } from '../../../shared/format';
import { Icon } from '../../../shared/ui/icon';
import { MenuDirective } from '../../../shared/ui/menu';
import { ClipTooltip, Tooltip } from '../../../shared/ui/tooltip';

interface Row {
  id: string;
  title: string;
  preview: string;
  previewMuted: boolean;
  date: string;
  folder: { name: string; color: number } | null;
  locked: boolean;
  pinned: boolean;
  groupStart: string | null;
}

const SORT_LABELS: Record<SortBy, string> = {
  updated: 'Last edited',
  created: 'Date created',
  title: 'Title',
};

@Component({
  selector: 'app-note-list',
  imports: [RouterLink, Icon, MenuDirective, Tooltip, ClipTooltip],
  templateUrl: './note-list.html',
  styleUrl: './note-list.scss',
})
export class NoteList {
  protected readonly store = inject(NotesStore);
  protected readonly settings = inject(SettingsStore);
  private readonly confirm = inject(ConfirmService);

  readonly openDrawer = output();
  readonly newNote = output();

  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');

  protected readonly sortOptions = Object.entries(SORT_LABELS) as [SortBy, string][];
  protected readonly sortLabel = computed(() => SORT_LABELS[this.store.sortBy()]);

  protected readonly rows = computed<Row[]>(() => {
    const hide = this.settings.settings().hidePreviews;
    const folders = this.store.folderById();
    const trash = this.store.isTrashView();
    const notes = this.store.listNotes();
    const hasPinned = !trash && notes.some((n) => n.pinned);
    return notes.map((n: Note, i): Row => {
      const text = firstLine(n.body);
      const folder = n.folderId ? folders.get(n.folderId) : undefined;
      let preview = text || 'No additional text';
      if (n.locked) preview = 'Locked';
      else if (hide) preview = 'Preview hidden';
      const prev = notes[i - 1];
      let groupStart: string | null = null;
      if (hasPinned && i === 0) groupStart = 'Pinned';
      else if (hasPinned && prev?.pinned && !n.pinned) groupStart = 'Notes';
      return {
        id: n.id,
        title: n.title.trim() || 'Untitled',
        preview,
        previewMuted: n.locked || hide || !text,
        date: formatListDate(trash && n.trashedAt ? n.trashedAt : n.updatedAt),
        folder: folder ? { name: folder.name, color: folder.color } : null,
        locked: n.locked,
        pinned: n.pinned,
        groupStart,
      };
    });
  });

  protected readonly emptyText = computed(() => {
    if (this.store.search().trim()) return `Nothing matches “${this.store.search().trim()}”.`;
    if (this.store.tag()) return `No notes tagged #${this.store.tag()} here.`;
    switch (this.store.view().kind) {
      case 'trash':
        return 'Trash is empty.';
      case 'pinned':
        return 'Pin a note to keep it at the top.';
      case 'locked':
        return 'Locked notes hide their text until you choose to show it.';
      case 'folder':
        return 'This folder is empty.';
      default:
        return 'No notes yet.';
    }
  });

  focusSearch(): void {
    this.searchInput().nativeElement.focus();
  }

  protected clearSearch(input: HTMLInputElement): void {
    this.store.search.set('');
    input.focus();
  }

  protected setSort(value: SortBy, menu: MenuDirective): void {
    this.store.sortBy.set(value);
    menu.close(true);
  }

  protected togglePreviews(): void {
    this.settings.update({ hidePreviews: !this.settings.settings().hidePreviews });
  }

  protected async emptyTrash(): Promise<void> {
    const count = this.store.counts().trash;
    const ok = await this.confirm.ask({
      title: 'Empty Trash?',
      message: `${plural(count, 'note')} will be deleted permanently. This can’t be undone.`,
      confirmLabel: 'Delete permanently',
      danger: true,
    });
    if (ok) this.store.emptyTrash();
  }
}
