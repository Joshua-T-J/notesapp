import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmService } from '../../../core/feedback/confirm.service';
import {
  FOLDER_COLORS,
  FOLDER_COLOR_NAMES,
  FolderColor,
  FolderColorChoice,
  NoteView,
} from '../../../core/notes/note.model';
import { FolderEntry, NotesStore } from '../../../core/notes/notes.store';
import { SettingsStore } from '../../../core/settings/settings.store';
import { ThemePreference, ThemeService } from '../../../core/theme/theme.service';
import { plural } from '../../../shared/format';
import { Icon, IconName } from '../../../shared/ui/icon';
import { MenuDirective } from '../../../shared/ui/menu';
import { ClipTooltip, Tooltip } from '../../../shared/ui/tooltip';
import { FolderColorPicker } from '../folders/folder-color-picker';

interface ViewItem {
  view: NoteView;
  label: string;
  icon: IconName;
  count: number;
}

@Component({
  selector: 'app-library-sidebar',
  imports: [RouterLink, Icon, MenuDirective, Tooltip, ClipTooltip, FolderColorPicker],
  templateUrl: './library-sidebar.html',
  styleUrl: './library-sidebar.scss',
  host: { '[class.rail]': 'rail()' },
})
export class LibrarySidebar {
  protected readonly store = inject(NotesStore);
  protected readonly theme = inject(ThemeService);
  private readonly settings = inject(SettingsStore);
  private readonly confirm = inject(ConfirmService);

  /** Icon-only mode (collapsed on a wide screen). */
  readonly rail = input(false);
  readonly newNote = output();
  readonly navigated = output();
  readonly closeDrawer = output();

  protected readonly addingFolder = signal(false);
  protected readonly newFolderColor = signal<FolderColorChoice>('random');
  protected readonly renamingId = signal<string | null>(null);
  private readonly folderInput = viewChild<ElementRef<HTMLInputElement>>('folderInput');

  protected readonly colorOptions = FOLDER_COLORS.map((value) => ({
    value,
    name: FOLDER_COLOR_NAMES[value],
  }));

  protected readonly views = computed<ViewItem[]>(() => {
    const c = this.store.counts();
    return [
      { view: { kind: 'all' }, label: 'All notes', icon: 'notes', count: c.all },
      { view: { kind: 'pinned' }, label: 'Pinned', icon: 'pin', count: c.pinned },
      { view: { kind: 'locked' }, label: 'Locked', icon: 'lock', count: c.locked },
      { view: { kind: 'trash' }, label: 'Trash', icon: 'trash', count: c.trash },
    ];
  });

  protected readonly themeOptions: { value: ThemePreference; label: string; icon: IconName }[] = [
    { value: 'system', label: 'System', icon: 'theme' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
  ];

  protected readonly status = computed(() => {
    switch (this.store.saveState()) {
      case 'saving':
        return 'Saving…';
      case 'error':
        return 'Not saved';
      default:
        return 'On this device';
    }
  });

  protected readonly statusDetail = computed(() =>
    this.store.saveState() === 'error'
      ? 'Not saved: browser storage is full or blocked. Export your notes to keep them.'
      : 'Notes are saved in this browser',
  );

  /** Tooltip text only exists in rail mode; in the full sidebar the label is visible. */
  protected tip(text: string): string {
    return this.rail() ? text : '';
  }

  protected toggleCollapsed(): void {
    this.settings.update({ sidebarCollapsed: !this.settings.settings().sidebarCollapsed });
  }

  protected isCurrent(view: NoteView): boolean {
    const current = this.store.view();
    return (
      current.kind === view.kind &&
      (view.kind !== 'folder' || (current.kind === 'folder' && current.folderId === view.folderId))
    );
  }

  protected isFolderCurrent(id: string): boolean {
    return this.isCurrent({ kind: 'folder', folderId: id });
  }

  protected select(view: NoteView): void {
    this.store.setView(view);
    this.navigated.emit();
  }

  protected selectFolder(id: string): void {
    this.select({ kind: 'folder', folderId: id });
  }

  protected selectTag(tag: string): void {
    this.store.toggleTag(tag);
    this.navigated.emit();
  }

  // ---- folders ---------------------------------------------------------------------
  protected startAddFolder(): void {
    if (this.rail()) this.toggleCollapsed();
    this.newFolderColor.set('random');
    this.addingFolder.set(true);
    setTimeout(() => this.folderInput()?.nativeElement.focus());
  }

  protected commitFolder(input: HTMLInputElement): void {
    if (!input.value.trim()) {
      input.focus();
      return;
    }
    const id = this.store.addFolder(input.value, this.newFolderColor());
    input.value = '';
    this.addingFolder.set(false);
    if (id) {
      // A brand-new folder is empty; a leftover tag filter would only hide that.
      this.store.tag.set(null);
      this.selectFolder(id);
    }
  }

  protected cancelFolder(): void {
    this.addingFolder.set(false);
  }

  protected startRename(folder: FolderEntry, menu: MenuDirective): void {
    menu.close();
    this.renamingId.set(folder.id);
    setTimeout(() => {
      const el = document.getElementById(`rename-${folder.id}`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
  }

  protected commitRename(id: string, input: HTMLInputElement): void {
    if (this.renamingId() !== id) return;
    this.store.renameFolder(id, input.value);
    this.renamingId.set(null);
  }

  protected setColor(folder: FolderEntry, color: FolderColor, menu: MenuDirective): void {
    this.store.setFolderColor(folder.id, color);
    menu.close(true);
  }

  protected async deleteFolder(folder: FolderEntry, menu: MenuDirective): Promise<void> {
    menu.close();
    const ok = await this.confirm.ask({
      title: `Delete “${folder.name}”?`,
      message: folder.count
        ? `${plural(folder.count, 'note')} in this folder will stay, without a folder.`
        : 'The folder is empty.',
      confirmLabel: 'Delete folder',
      danger: true,
    });
    if (ok) this.store.deleteFolder(folder.id);
  }

  protected setTheme(value: ThemePreference, menu: MenuDirective): void {
    this.theme.setPreference(value);
    menu.close(true);
  }
}
