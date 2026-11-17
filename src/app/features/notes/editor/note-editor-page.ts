import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Block, bodyStats } from '../../../core/content/blocks';
import { ExportService } from '../../../core/export/export.service';
import { ConfirmService } from '../../../core/feedback/confirm.service';
import { ToastService } from '../../../core/feedback/toast.service';
import { NotesStore } from '../../../core/notes/notes.store';
import { SettingsStore } from '../../../core/settings/settings.store';
import { formatEdited, plural } from '../../../shared/format';
import { Icon } from '../../../shared/ui/icon';
import { MenuDirective } from '../../../shared/ui/menu';
import { ClipTooltip, Tooltip } from '../../../shared/ui/tooltip';
import { FolderPicker } from '../folders/folder-picker';
import { BlockEditor } from './block-editor';
import { FormatToolbar } from './format-toolbar';

@Component({
  selector: 'app-note-editor-page',
  imports: [
    RouterLink,
    Icon,
    MenuDirective,
    Tooltip,
    ClipTooltip,
    BlockEditor,
    FolderPicker,
    FormatToolbar,
  ],
  templateUrl: './note-editor-page.html',
  styleUrl: './note-editor-page.scss',
})
export class NoteEditorPage {
  /** Route param, bound by `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  protected readonly store = inject(NotesStore);
  private readonly settings = inject(SettingsStore);
  private readonly exporter = inject(ExportService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly note = this.store.openNote;
  protected readonly hidden = computed(() => {
    const n = this.note();
    return !!n && this.store.isHidden(n);
  });
  protected readonly inTrash = computed(() => this.note()?.trashedAt != null);
  protected readonly folderName = computed(() => {
    const id = this.note()?.folderId;
    return id ? (this.store.folderById().get(id)?.name ?? null) : null;
  });
  protected readonly edited = computed(() => {
    const n = this.note();
    return n ? `Edited ${formatEdited(n.updatedAt)}` : '';
  });
  protected readonly stats = computed(() => {
    const n = this.note();
    if (!n) return '';
    const s = bodyStats(n.body);
    return [plural(s.words, 'word'), s.tasks ? `${s.done}/${s.tasks} done` : '']
      .filter(Boolean)
      .join(' · ');
  });
  protected readonly saveLabel = computed(
    () =>
      ({ saved: 'Saved on this device', saving: 'Saving…', error: 'Not saved' })[
        this.store.saveState()
      ],
  );
  protected readonly addingTag = signal(false);
  private readonly injector = inject(Injector);

  protected readonly editor = viewChild(BlockEditor);
  private readonly titleInput = viewChild<ElementRef<HTMLTextAreaElement>>('titleInput');
  private readonly tagInput = viewChild<ElementRef<HTMLInputElement>>('tagInput');

  constructor() {
    // Track the open note; re-lock a revealed note when leaving it (if enabled).
    let previous: string | null = null;
    effect(() => {
      const id = this.id();
      untracked(() => {
        if (previous && previous !== id && this.settings.settings().relockOnLeave)
          this.store.relock(previous);
        previous = id;
        this.store.openNoteId.set(id);
        this.addingTag.set(false);
      });
    });

    // A note created with "New note" opens with the title focused.
    effect(() => {
      this.id();
      const el = this.titleInput()?.nativeElement;
      const state = history.state as { focusTitle?: boolean } | null;
      if (el) queueMicrotask(() => this.fitTitle(el));
      if (el && state?.focusTitle && untracked(this.note)?.title === '') {
        queueMicrotask(() => el.focus());
      }
    });

    // A note that no longer exists (deleted, Trash emptied, old link) returns to the empty pane.
    effect(() => {
      if (this.store.loaded() && !this.note()) {
        void this.router.navigate(['/app'], { replaceUrl: true });
      }
    });

    inject(DestroyRef).onDestroy(() => {
      if (previous && this.settings.settings().relockOnLeave) this.store.relock(previous);
      this.store.openNoteId.set(null);
    });
  }

  // ---- title / tags ------------------------------------------------------------
  protected onTitle(id: string, el: HTMLTextAreaElement): void {
    // Titles are one line; pasted newlines become spaces.
    if (el.value.includes('\n')) el.value = el.value.replace(/\n+/g, ' ');
    this.store.setTitle(id, el.value);
    this.fitTitle(el);
  }

  /** Grows the title box with its text (fallback for browsers without CSS `field-sizing`). */
  private fitTitle(el: HTMLTextAreaElement): void {
    if (CSS.supports('field-sizing', 'content')) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  protected titleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || (event.key === 'ArrowDown' && !event.shiftKey)) {
      const ta = event.target as HTMLTextAreaElement;
      if (event.key === 'ArrowDown' && ta.selectionStart !== ta.value.length) return;
      event.preventDefault();
      this.editor()?.focus(false);
    }
  }

  protected startTag(): void {
    this.addingTag.set(true);
    // The input exists only after the next render; focus it then so no second click is needed.
    afterNextRender(() => this.tagInput()?.nativeElement.focus(), { injector: this.injector });
  }

  protected commitTag(id: string, input: HTMLInputElement, keepOpen: boolean): void {
    if (input.value.trim()) this.store.addTag(id, input.value);
    input.value = '';
    if (!keepOpen) this.addingTag.set(false);
  }

  // ---- body ----------------------------------------------------------------------
  protected onBody(id: string, blocks: Block[]): void {
    this.store.setBody(id, blocks);
  }

  // ---- note actions --------------------------------------------------------------
  protected export(format: 'md' | 'txt', menu: MenuDirective): void {
    menu.close(true);
    const n = this.note();
    if (!n) return;
    void this.exporter.downloadNote(n, format);
  }

  protected async copyMarkdown(menu: MenuDirective): Promise<void> {
    menu.close(true);
    const n = this.note();
    if (!n) return;
    try {
      await navigator.clipboard.writeText(this.exporter.noteAsMarkdown(n));
      this.toast.show('Copied as Markdown');
    } catch {
      this.toast.show('Couldn’t copy. Try Export instead.', 'error');
    }
  }

  protected duplicate(menu: MenuDirective): void {
    menu.close();
    const copy = this.store.duplicate(this.id());
    if (copy) void this.router.navigate(['/app/note', copy]);
  }

  protected async trash(menu: MenuDirective): Promise<void> {
    menu.close();
    const title = this.note()?.title.trim() || 'Untitled';
    const ok = await this.confirm.ask({
      title: `Move “${title}” to Trash?`,
      message: 'You can restore it from Trash until you empty it.',
      confirmLabel: 'Move to Trash',
      danger: true,
    });
    if (!ok) return;
    this.store.trash(this.id());
    this.toast.show('Moved to Trash');
    void this.router.navigate(['/app']);
  }

  protected restore(): void {
    this.store.restore(this.id());
    this.toast.show('Restored');
  }

  protected async deleteForever(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete this note permanently?',
      message: 'It will be removed from this device. This can’t be undone.',
      confirmLabel: 'Delete permanently',
      danger: true,
    });
    if (!ok) return;
    this.store.deleteForever(this.id());
    void this.router.navigate(['/app']);
  }

  protected setFolder(folderId: string | null): void {
    this.store.setFolder(this.id(), folderId);
  }
}
