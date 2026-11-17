import {
  Component,
  computed,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { EditorMode, Note } from '../../models/note.model';
import { NotesStore } from '../../services/notes-store';
import { formatRelativeTime, getNoteMetrics } from '../../utils/note-helpers';
import { FolderSelect } from '../folder-select/folder-select';
import { MarkdownPreview } from '../markdown-preview/markdown-preview';

type FormatType = 'bold' | 'italic' | 'h1' | 'h2' | 'checklist' | 'bullet' | 'quote' | 'code';

interface FormatAction {
  type: FormatType;
  icon: string;
  title: string;
  label?: string;
}

interface ModeOption {
  mode: EditorMode;
  icon: string;
  label: string;
  title: string;
}

/** Full-screen note editor: toolbar, Markdown formatting bar, write/split/preview panes, status bar. */
@Component({
  selector: 'app-note-studio',
  imports: [FolderSelect, MarkdownPreview],
  templateUrl: './note-studio.html',
  styleUrl: './note-studio.scss',
})
export class NoteStudio {
  protected readonly store = inject(NotesStore);
  private readonly document = inject(DOCUMENT);

  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private readonly bodyInput = viewChild<ElementRef<HTMLTextAreaElement>>('bodyInput');

  protected readonly modes: readonly ModeOption[] = [
    { mode: 'write', icon: 'bi-pencil', label: 'Write', title: 'Write Mode' },
    { mode: 'split', icon: 'bi-layout-split', label: 'Split', title: 'Side-by-Side Split Markdown' },
    { mode: 'preview', icon: 'bi-eye', label: 'Preview', title: 'Clean Interactive Reader' },
  ];

  protected readonly formatGroups: readonly (readonly FormatAction[])[] = [
    [
      { type: 'bold', icon: 'bi-type-bold', title: 'Bold (**text**)' },
      { type: 'italic', icon: 'bi-type-italic', title: 'Italic (*text*)' },
    ],
    [
      { type: 'h1', icon: 'bi-type-h1', title: 'Heading 1 (# )' },
      { type: 'h2', icon: 'bi-type-h2', title: 'Heading 2 (## )' },
    ],
    [
      { type: 'checklist', icon: 'bi-check2-square', title: 'Interactive Checklist (- [ ] )', label: 'Checklist' },
      { type: 'bullet', icon: 'bi-list-ul', title: 'Bullet List (- )' },
      { type: 'quote', icon: 'bi-chat-square-quote', title: 'Blockquote (> )' },
      { type: 'code', icon: 'bi-code-slash', title: 'Code Block (```)' },
    ],
  ];

  protected readonly isOpen = computed(() => this.store.detailNoteId() !== null);

  /** Keeps the last opened note rendered while the studio fades out. */
  protected readonly note = linkedSignal<Note | null, Note | null>({
    source: this.store.detailNote,
    computation: (current, previous) => current ?? previous?.value ?? null,
  });

  protected readonly isLocked = computed(() => {
    const note = this.note();
    return !!note && note.sensitive && !this.store.isUnlocked(note.id);
  });

  protected readonly metrics = computed(() => getNoteMetrics(this.note()?.content ?? ''));
  protected readonly updatedLabel = computed(() => {
    const note = this.note();
    return note ? formatRelativeTime(note.updatedAt) : '';
  });

  constructor() {
    // A freshly created note opens with its title selected, ready to be renamed.
    effect(() => {
      const pendingId = this.store.pendingTitleFocusId();
      if (pendingId === null || pendingId !== this.store.detailNoteId()) {
        return;
      }
      setTimeout(() => {
        const input = this.titleInput()?.nativeElement;
        input?.focus();
        input?.select();
        this.store.pendingTitleFocusId.set(null);
      }, 50);
    });
  }

  protected addTag(input: HTMLInputElement, noteId: string): void {
    this.store.addTag(noteId, input.value);
    input.value = '';
  }

  protected applyFormat(type: FormatType, noteId: string): void {
    const textarea = this.bodyInput()?.nativeElement;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    let replacement = '';

    switch (type) {
      case 'bold':
        replacement = `**${selected || 'bold text'}**`;
        break;
      case 'italic':
        replacement = `*${selected || 'italic text'}*`;
        break;
      case 'h1':
        replacement = `\n# ${selected || 'Heading 1'}\n`;
        break;
      case 'h2':
        replacement = `\n## ${selected || 'Heading 2'}\n`;
        break;
      case 'checklist':
        replacement = `\n- [ ] ${selected || 'Task item'}`;
        break;
      case 'bullet':
        replacement = `\n- ${selected || 'List item'}`;
        break;
      case 'quote':
        replacement = `\n> ${selected || 'Key quote'}`;
        break;
      case 'code':
        replacement = `\n\`\`\`javascript\n${selected || '// code'}\n\`\`\`\n`;
        break;
    }

    textarea.setRangeText(replacement, start, end, 'end');
    this.store.setBody(noteId, textarea.value);
    textarea.focus();
  }

  protected exportNote(ext: 'md' | 'txt'): void {
    const note = this.note();
    if (!note) {
      return;
    }
    const filename = `${(note.title || 'note').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${ext}`;
    const url = URL.createObjectURL(new Blob([note.content || ''], { type: 'text/plain;charset=utf-8' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = filename;
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
