import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AssetStore } from '../../../core/assets/asset-store';
import { ImageError, prepareImage } from '../../../core/assets/image-processing';
import {
  Align,
  Block,
  BlockType,
  Highlight,
  ImageWidth,
  MAX_SIZE,
  MIN_SIZE,
  TextColor,
  blockText,
  normalizeHref,
} from '../../../core/content/blocks';
import {
  MarkState,
  TextRange,
  clearMarks,
  isCollapsed,
  marksIn,
  setAlign as alignBlocks,
  setBlockTypes,
  updateMarks,
  wordAt,
} from '../../../core/content/ranges';
import { ToastService } from '../../../core/feedback/toast.service';
import {
  applyShortcut,
  blockElementOf,
  blockTypeOf,
  caretAtEnd,
  caretAtStart,
  createBlockElement,
  getSelectionRange,
  parseBlocks,
  placeCaret,
  renderBlocks,
  setBlockType,
  setSelectionRange,
  splitBlock,
  wrapLooseNodes,
} from './editor-dom';

export interface FormatState {
  type: BlockType | null;
  align: Align;
  marks: MarkState;
}

export type ToggleMark = 'bold' | 'italic' | 'underline' | 'strike' | 'code';

interface Snapshot {
  blocks: Block[];
  range: TextRange | null;
}

interface Popover {
  top: number;
  left: number;
}

const HISTORY_LIMIT = 200;
const TYPING_GROUP_MS = 1000;
/** Width of the checkbox area at the start of a checklist line (matches the CSS). */
const CHECKBOX_HIT_PX = 30;
const NATIVE_FALLBACK: Record<ToggleMark, string | null> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strikeThrough',
  code: null,
};

const EMPTY_MARKS: MarkState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  color: null,
  highlight: null,
  size: 0,
  href: null,
};

/**
 * The note editor: paragraphs, headings, lists, checklists, quotes, code, images, and inline
 * formatting. Content comes in and goes out as `Block[]`. Typing is handled by the browser;
 * every formatting command is applied to the block model and re-rendered, with the selection
 * restored, so the result is always valid and undoable. Paste is plain text (or images).
 */
@Component({
  selector: 'app-block-editor',
  templateUrl: './block-editor.html',
  styleUrl: './block-editor.scss',
  encapsulation: ViewEncapsulation.None,
})
export class BlockEditor {
  readonly noteId = input.required<string>();
  readonly blocks = input.required<Block[]>();
  readonly readonly = input(false);
  readonly label = input('Note text');
  readonly changed = output<Block[]>();

  private readonly assets = inject(AssetStore);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  readonly format = signal<FormatState>({ type: null, align: 'left', marks: EMPTY_MARKS });
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  protected readonly empty = signal(true);
  protected readonly announcement = signal('');

  // Link and image-description dialogs
  protected readonly linkPop = signal<(Popover & { href: string; editing: boolean }) | null>(null);
  protected readonly linkError = signal('');
  protected readonly altPop = signal<(Popover & { assetId: string; alt: string }) | null>(null);

  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly linkInput = viewChild<ElementRef<HTMLInputElement>>('linkInput');
  private readonly altInput = viewChild<ElementRef<HTMLTextAreaElement>>('altInput');
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  private model: Block[] = [];
  private lastRange: TextRange | null = null;
  private pendingRange: TextRange | null = null;
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private lastTypingAt = 0;
  private lastTypingKind = '';

  protected readonly isReadonly = computed(() => this.readonly());

  constructor() {
    // Re-render only when a different note is loaded; history belongs to one note.
    effect(() => {
      this.noteId();
      const blocks = untracked(this.blocks);
      untracked(() => {
        this.model = structuredClone(blocks);
        this.undoStack = [];
        this.redoStack = [];
        this.syncHistory();
        this.render(this.model);
        this.lastRange = null;
        this.linkPop.set(null);
        this.altPop.set(null);
      });
    });

    const onSelectionChange = () => this.trackSelection();
    document.addEventListener('selectionchange', onSelectionChange);
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('selectionchange', onSelectionChange),
    );
  }

  // ===========================================================================
  // Public API (used by the formatting toolbar)
  // ===========================================================================

  focus(atEnd = false): void {
    const el = this.root().nativeElement;
    el.focus();
    const target = atEnd ? el.lastElementChild : el.firstElementChild;
    if (target instanceof HTMLElement) placeCaret(target, atEnd);
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.snapshot());
    this.restore(prev);
    this.announce('Undone');
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.snapshot());
    this.restore(next);
    this.announce('Redone');
  }

  setBlockType(type: BlockType): void {
    this.edit((blocks, range) => setBlockTypes(blocks, range, type));
  }

  setAlign(align: Align): void {
    this.edit((blocks, range) => ({ blocks: alignBlocks(blocks, range, align), range }));
  }

  toggleMark(mark: ToggleMark): void {
    const on = !this.format().marks[mark];
    this.editMarks((m) => ({ ...m, [mark]: on }), mark);
  }

  setColor(color: TextColor | null): void {
    this.editMarks((m) => ({ ...m, color: color ?? undefined }));
  }

  setHighlight(highlight: Highlight | null): void {
    this.editMarks((m) => ({ ...m, highlight: highlight ?? undefined }));
  }

  changeSize(delta: 1 | -1): void {
    this.editMarks((m) => ({
      ...m,
      size: Math.max(MIN_SIZE, Math.min(MAX_SIZE, (m.size ?? 0) + delta)),
    }));
  }

  clearFormatting(): void {
    this.edit((blocks, range) => {
      const r = isCollapsed(range) ? wordAt(blocks, range.start) : range;
      return r ? { blocks: clearMarks(blocks, r), range } : null;
    });
  }

  /** Opens the link dialog for the selection (or the word at the caret). */
  openLinkDialog(): void {
    if (this.readonly()) return;
    const range = this.currentRange();
    const target = range && (isCollapsed(range) ? wordAt(this.model, range.start) : range);
    if (!target) {
      this.announce('Select the text you want to link first');
      this.toast.show('Select the text you want to link first.');
      return;
    }
    this.pendingRange = target;
    const href = marksIn(this.model, target).href ?? '';
    this.linkError.set('');
    this.linkPop.set({ ...this.popoverPosition(), href, editing: !!href });
    afterNextRender(() => this.linkInput()?.nativeElement.select(), { injector: this.injector });
  }

  pickImages(): void {
    if (!this.readonly()) this.fileInput().nativeElement.click();
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  protected onBeforeInput(event: InputEvent): void {
    if (this.readonly()) return;
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      if (event.inputType === 'historyUndo') this.undo();
      else this.redo();
      return;
    }
    if (event.inputType.startsWith('format')) {
      // Browser formatting (menus, shortcuts we don't handle) would bypass the model.
      event.preventDefault();
      return;
    }
    // Typing is grouped into one undo step per burst.
    const kind = event.inputType.startsWith('delete') ? 'delete' : 'insert';
    const now = Date.now();
    if (now - this.lastTypingAt > TYPING_GROUP_MS || kind !== this.lastTypingKind)
      this.pushHistory();
    this.lastTypingAt = now;
    this.lastTypingKind = kind;
  }

  protected onInput(): void {
    const root = this.root().nativeElement;
    const sel = document.getSelection();

    const loose = wrapLooseNodes(root);
    if (loose && sel) placeCaret(loose, true);
    if (!root.firstElementChild) {
      const p = createBlockElement(document, { type: 'p', spans: [] });
      root.append(p);
      placeCaret(p, false);
    }

    const block = sel?.anchorNode ? blockElementOf(root, sel.anchorNode) : null;
    if (block) {
      const converted = applyShortcut(block);
      if (converted) placeCaret(converted, true);
    }
    this.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.readonly()) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    // ---- shortcuts ----
    if (mod && !event.altKey) {
      const shortcut = this.shortcutFor(event, key);
      if (shortcut) {
        event.preventDefault();
        shortcut();
        return;
      }
    }

    const root = this.root().nativeElement;
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const block = blockElementOf(root, range.startContainer);
    if (!block) return;
    const type = blockTypeOf(block);

    if (event.key === 'Enter' && mod && type === 'todo') {
      event.preventDefault();
      this.pushHistory();
      this.toggleTodo(block);
      return;
    }

    if (event.key === 'Enter' && type === 'code' && !mod) {
      event.preventDefault();
      this.pushHistory();
      this.codeEnter(block, range);
      return;
    }

    if (event.key === 'Enter' && event.shiftKey && !mod) {
      event.preventDefault();
      this.pushHistory();
      document.execCommand('insertLineBreak');
      this.emit();
      return;
    }

    if (event.key === 'Enter' && !mod) {
      event.preventDefault();
      this.pushHistory();
      if (!range.collapsed) range.deleteContents();
      const listLike = type === 'bullet' || type === 'todo' || type === 'ol' || type === 'quote';
      if (listLike && !block.textContent) placeCaret(setBlockType(block, 'p'), false);
      else placeCaret(splitBlock(block, range), false);
      this.emit();
      return;
    }

    if (event.key === 'Backspace' && range.collapsed && caretAtStart(block, range)) {
      if (type !== 'p') {
        event.preventDefault();
        this.pushHistory();
        placeCaret(setBlockType(block, 'p'), false);
        this.emit();
        return;
      }
      const prev = block.previousElementSibling as HTMLElement | null;
      if (prev?.dataset['type'] === 'image') {
        // Select the image instead of merging into it; Backspace again removes it.
        event.preventDefault();
        prev.focus();
        return;
      }
    }

    if (event.key === 'Delete' && range.collapsed && caretAtEnd(block, range)) {
      const next = block.nextElementSibling as HTMLElement | null;
      if (next?.dataset['type'] === 'image') {
        event.preventDefault();
        next.focus();
      }
    }
  }

  /** Keyboard handling on a focused image. */
  protected onFigureKeydown(event: KeyboardEvent): void {
    const fig = (event.target as HTMLElement).closest('figure');
    if (!fig || event.target !== fig || this.readonly()) return;
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      this.removeImage(fig.dataset['asset'] ?? '');
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.openAltDialog(fig.dataset['asset'] ?? '');
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      const next = fig.nextElementSibling;
      if (next instanceof HTMLElement && next.dataset['type'] !== 'image') {
        event.preventDefault();
        this.root().nativeElement.focus();
        placeCaret(next, false);
      }
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      const prev = fig.previousElementSibling;
      if (prev instanceof HTMLElement && prev.dataset['type'] !== 'image') {
        event.preventDefault();
        this.root().nativeElement.focus();
        placeCaret(prev, true);
      }
    }
  }

  protected onMousedown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Ctrl/Cmd + click opens a link.
    const link = target.closest('a');
    if (link && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      window.open(link.href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (this.readonly()) return;
    const root = this.root().nativeElement;
    const block = blockElementOf(root, target);
    if (!block || blockTypeOf(block) !== 'todo') return;
    const rect = block.getBoundingClientRect();
    if (event.clientX - rect.left <= CHECKBOX_HIT_PX) {
      event.preventDefault();
      this.pushHistory();
      this.toggleTodo(block);
    }
  }

  /** Image toolbar buttons (inside the non-editable figure). */
  protected onClick(event: MouseEvent): void {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    const fig = button?.closest('figure');
    if (!button || !fig || this.readonly()) return;
    event.preventDefault();
    const id = fig.dataset['asset'] ?? '';
    const action = button.dataset['action'] ?? '';
    if (action === 'alt') this.openAltDialog(id);
    else if (action === 'remove') this.removeImage(id);
    else if (action.startsWith('width:'))
      this.updateImage(id, { width: action.slice(6) as ImageWidth });
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    if (this.readonly()) return;
    const files = [...(event.clipboardData?.files ?? [])].filter((f) =>
      f.type.startsWith('image/'),
    );
    if (files.length) {
      void this.insertImages(files);
      return;
    }
    const text = (event.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n');
    if (!text) return;
    this.pushHistory();
    const range = this.currentRange();
    const blocks = parseBlocks(this.root().nativeElement);
    const block = range ? blocks[range.start.block] : undefined;
    if (block?.type === 'code' || !text.includes('\n')) {
      document.execCommand('insertText', false, text);
      this.emit();
      return;
    }
    // Multi-line text: each line becomes a paragraph, merged around the caret.
    const [first = '', ...rest] = text.split('\n');
    document.execCommand('insertText', false, first);
    const root = this.root().nativeElement;
    const sel = document.getSelection();
    const current = sel?.anchorNode ? blockElementOf(root, sel.anchorNode) : null;
    if (current && sel && sel.rangeCount) {
      const tail = splitBlock(current, sel.getRangeAt(0));
      let last = current;
      for (const line of rest) {
        const el = createBlockElement(document, { type: 'p', spans: line ? [{ text: line }] : [] });
        last.after(el);
        last = el;
      }
      const tailNodes = Array.from(tail.childNodes).filter((n) => n.nodeName !== 'BR');
      tail.remove();
      if (last.textContent === '') last.replaceChildren();
      const marker = last.lastChild;
      last.append(...tailNodes);
      if (!last.firstChild) last.append(document.createElement('br'));
      const caret = document.createRange();
      if (marker) caret.setStartAfter(marker);
      else caret.setStart(last, 0);
      caret.collapse(true);
      sel.removeAllRanges();
      sel.addRange(caret);
    }
    this.emit();
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    if (this.readonly()) return;
    const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) void this.insertImages(files);
  }

  protected onFilesPicked(input: HTMLInputElement): void {
    const files = [...(input.files ?? [])];
    input.value = '';
    if (files.length) void this.insertImages(files);
  }

  // ---- link dialog ----
  protected applyLink(raw: string): void {
    const range = this.pendingRange;
    if (!range) return;
    const href = normalizeHref(raw);
    if (!href) {
      this.linkError.set('Enter a web address (https://…) or an email address.');
      return;
    }
    this.closeLink(false);
    this.editRange(range, (m) => ({ ...m, href }));
    this.announce('Link added');
  }

  protected removeLink(): void {
    const range = this.pendingRange;
    this.closeLink(false);
    if (range) this.editRange(range, (m) => ({ ...m, href: undefined }));
    this.announce('Link removed');
  }

  protected closeLink(restore = true): void {
    this.linkPop.set(null);
    if (restore && this.pendingRange) this.restoreSelection(this.pendingRange);
  }

  // ---- image description dialog ----
  protected saveAlt(text: string): void {
    const pop = this.altPop();
    if (!pop) return;
    this.altPop.set(null);
    this.updateImage(pop.assetId, { alt: text.trim().slice(0, 1000) });
    this.focusFigure(pop.assetId);
  }

  protected closeAlt(): void {
    const pop = this.altPop();
    this.altPop.set(null);
    if (pop) this.focusFigure(pop.assetId);
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private shortcutFor(event: KeyboardEvent, key: string): (() => void) | null {
    const shift = event.shiftKey;
    if (key === 'z' && !shift) return () => this.undo();
    if ((key === 'z' && shift) || key === 'y') return () => this.redo();
    if (key === 'b' && !shift) return () => this.toggleMark('bold');
    if (key === 'i' && !shift) return () => this.toggleMark('italic');
    if (key === 'u' && !shift) return () => this.toggleMark('underline');
    if (key === 'x' && shift) return () => this.toggleMark('strike');
    if (key === 'e' && !shift) return () => this.toggleMark('code');
    if (key === 'k' && !shift) return () => this.openLinkDialog();
    if (shift && (event.key === '>' || event.code === 'Period')) return () => this.changeSize(1);
    if (shift && (event.key === '<' || event.code === 'Comma')) return () => this.changeSize(-1);
    if (shift && event.code === 'Digit7') return () => this.setBlockType('ol');
    if (shift && event.code === 'Digit8') return () => this.setBlockType('bullet');
    if (shift && event.code === 'Digit9') return () => this.setBlockType('todo');
    if (key === '\\') return () => this.clearFormatting();
    return null;
  }

  private snapshot(): Snapshot {
    return { blocks: structuredClone(this.model), range: this.lastRange };
  }

  private pushHistory(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.lastTypingAt = 0;
    this.syncHistory();
  }

  private syncHistory(): void {
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }

  private restore(s: Snapshot): void {
    this.model = structuredClone(s.blocks);
    this.render(this.model);
    this.root().nativeElement.focus({ preventScroll: true });
    if (s.range) setSelectionRange(this.root().nativeElement, s.range);
    this.lastTypingAt = 0;
    this.syncHistory();
    this.emit(false);
  }

  private render(blocks: readonly Block[]): void {
    const root = this.root().nativeElement;
    renderBlocks(root, blocks);
    this.empty.set(!blocks.some((b) => blockText(b).length || b.type !== 'p'));
    void this.hydrateImages(root);
  }

  private async hydrateImages(root: HTMLElement): Promise<void> {
    for (const fig of Array.from(root.querySelectorAll<HTMLElement>('figure[data-asset]'))) {
      const img = fig.querySelector('img');
      if (!img || img.src) continue;
      const url = await this.assets.url(fig.dataset['asset'] ?? '').catch(() => null);
      if (url) img.src = url;
      else fig.classList.add('missing');
    }
  }

  private emit(trackSelection = true): void {
    const blocks = parseBlocks(this.root().nativeElement);
    this.model = blocks;
    this.empty.set(!blocks.some((b) => blockText(b).length || b.type !== 'p'));
    this.changed.emit(blocks);
    if (trackSelection) this.trackSelection();
  }

  private currentRange(): TextRange | null {
    return getSelectionRange(this.root().nativeElement) ?? this.lastRange;
  }

  private restoreSelection(range: TextRange): void {
    const root = this.root().nativeElement;
    root.focus({ preventScroll: true });
    setSelectionRange(root, range);
  }

  /** Runs a model change against the current selection, then re-renders and restores it. */
  private edit(
    change: (blocks: Block[], range: TextRange) => { blocks: Block[]; range: TextRange } | null,
  ): void {
    if (this.readonly()) return;
    const root = this.root().nativeElement;
    const range = this.currentRange() ?? {
      start: { block: 0, offset: 0 },
      end: { block: 0, offset: 0 },
    };
    const blocks = parseBlocks(root);
    const result = change(blocks, range);
    if (!result) return;
    this.pushHistory();
    this.render(result.blocks);
    this.restoreSelection(result.range);
    this.emit();
  }

  private editRange(range: TextRange, change: Parameters<typeof updateMarks>[2]): void {
    this.edit((blocks) => ({ blocks: updateMarks(blocks, range, change), range }));
  }

  /** Inline formatting: a collapsed caret formats the word it is in. */
  private editMarks(change: Parameters<typeof updateMarks>[2], native?: ToggleMark): void {
    if (this.readonly()) return;
    const range = this.currentRange();
    if (!range) return;
    const target = isCollapsed(range) ? wordAt(this.model, range.start) : range;
    if (target) {
      this.edit((blocks) => ({ blocks: updateMarks(blocks, target, change), range }));
      return;
    }
    // Caret between words: bold/italic/underline/strike apply to what is typed next.
    const command = native ? NATIVE_FALLBACK[native] : null;
    if (command) {
      this.root().nativeElement.focus();
      document.execCommand(command);
      this.trackSelection();
    } else {
      this.announce('Select some text first');
    }
  }

  private codeEnter(block: HTMLElement, range: Range): void {
    const root = this.root().nativeElement;
    const index = Array.prototype.indexOf.call(root.children, block);
    const text = blockText(parseBlocks(root)[index] ?? { type: 'p', spans: [] });
    // Enter on an empty last line leaves the code block.
    if (range.collapsed && caretAtEnd(block, range) && text.endsWith('\n')) {
      const blocks = parseBlocks(root);
      const code = blocks[index];
      if (code) code.spans = [{ text: text.slice(0, -1) }].filter((s) => s.text);
      blocks.splice(index + 1, 0, { type: 'p', spans: [] });
      this.render(blocks);
      this.restoreSelection({
        start: { block: index + 1, offset: 0 },
        end: { block: index + 1, offset: 0 },
      });
      this.emit();
      return;
    }
    document.execCommand('insertLineBreak');
    this.emit();
  }

  private toggleTodo(block: HTMLElement): void {
    const checked = block.dataset['checked'] !== 'true';
    block.dataset['checked'] = String(checked);
    const text = (block.textContent ?? '').trim();
    this.announce(`${checked ? 'Done' : 'Not done'}: ${text || 'empty item'}`);
    this.emit();
  }

  private announce(text: string): void {
    // Clearing first makes repeated identical messages announce again.
    this.announcement.set('');
    setTimeout(() => this.announcement.set(text), 30);
  }

  private trackSelection(): void {
    const root = this.root().nativeElement;
    const range = getSelectionRange(root);
    if (!range) return;
    this.lastRange = range;
    const block = this.model[range.start.block];
    this.format.set({
      type: block?.type ?? null,
      align: block?.align ?? 'left',
      marks: marksIn(this.model, range),
    });
  }

  private popoverPosition(anchor?: Element): Popover {
    const sel = document.getSelection();
    const rect =
      anchor?.getBoundingClientRect() ??
      (sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null) ??
      this.root().nativeElement.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const below = rect.bottom + 8;
    const top = below + 220 > window.innerHeight ? Math.max(12, rect.top - 228) : below;
    return { top, left };
  }

  // ---- images ----
  private async insertImages(files: File[]): Promise<void> {
    const ids: string[] = [];
    for (const file of files) {
      try {
        const blob = await prepareImage(file);
        ids.push(await this.assets.put(blob));
      } catch (e) {
        this.toast.show(
          e instanceof ImageError ? e.message : 'That image couldn’t be added.',
          'error',
        );
      }
    }
    if (!ids.length) return;
    this.edit((blocks, range) => {
      const images: Block[] = ids.map((assetId) => ({
        type: 'image',
        spans: [],
        image: { assetId, alt: '', width: 'md' },
      }));
      const at = Math.min(range.end.block, blocks.length - 1);
      const current = blocks[at];
      const replaceEmpty = current && current.type === 'p' && !blockText(current);
      const out = [...blocks];
      if (at < 0) out.push(...images);
      else out.splice(replaceEmpty ? at : at + 1, replaceEmpty ? 1 : 0, ...images);
      const after = (replaceEmpty ? at : at + 1) + images.length;
      if (!out[after] || out[after]?.type === 'image')
        out.splice(after, 0, { type: 'p', spans: [] });
      return {
        blocks: out,
        range: { start: { block: after, offset: 0 }, end: { block: after, offset: 0 } },
      };
    });
    this.announce(ids.length === 1 ? 'Image added' : `${ids.length} images added`);
    // Ask for a description straight away: it is what screen reader users will hear.
    this.openAltDialog(ids[0]!);
  }

  private findImage(assetId: string): number {
    return this.model.findIndex((b) => b.type === 'image' && b.image?.assetId === assetId);
  }

  private updateImage(assetId: string, patch: Partial<{ alt: string; width: ImageWidth }>): void {
    const index = this.findImage(assetId);
    const block = this.model[index];
    if (!block?.image) return;
    this.pushHistory();
    const blocks = structuredClone(this.model);
    blocks[index] = { ...block, image: { ...block.image, ...patch } };
    this.render(blocks);
    this.emit(false);
    this.focusFigure(assetId);
  }

  private removeImage(assetId: string): void {
    const index = this.findImage(assetId);
    if (index < 0) return;
    this.pushHistory();
    const blocks = structuredClone(this.model);
    blocks.splice(index, 1);
    this.render(blocks);
    const target = Math.max(0, Math.min(index, this.root().nativeElement.children.length - 1));
    this.restoreSelection({
      start: { block: target, offset: 0 },
      end: { block: target, offset: 0 },
    });
    this.emit();
    this.announce('Image removed. Press Ctrl+Z to undo.');
  }

  private openAltDialog(assetId: string): void {
    const fig = this.root().nativeElement.querySelector(
      `figure[data-asset="${CSS.escape(assetId)}"]`,
    );
    const block = this.model[this.findImage(assetId)];
    if (!fig || !block?.image) return;
    this.altPop.set({ ...this.popoverPosition(fig), assetId, alt: block.image.alt });
    afterNextRender(() => this.altInput()?.nativeElement.focus(), { injector: this.injector });
  }

  private focusFigure(assetId: string): void {
    afterNextRender(
      () =>
        this.root()
          .nativeElement.querySelector<HTMLElement>(`figure[data-asset="${CSS.escape(assetId)}"]`)
          ?.focus(),
      { injector: this.injector },
    );
  }
}
