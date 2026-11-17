import { Component, ElementRef, afterNextRender, computed, inject, input } from '@angular/core';
import { ALIGNABLE, Align, BlockType, Highlight, TextColor } from '../../../core/content/blocks';
import { Icon, IconName } from '../../../shared/ui/icon';
import { MenuDirective } from '../../../shared/ui/menu';
import { Tooltip } from '../../../shared/ui/tooltip';
import { BlockEditor, ToggleMark } from './block-editor';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const STYLES: { type: BlockType; label: string }[] = [
  { type: 'p', label: 'Body' },
  { type: 'h2', label: 'Heading' },
  { type: 'h3', label: 'Subheading' },
  { type: 'quote', label: 'Quote' },
  { type: 'code', label: 'Code block' },
];

const COLORS: { value: TextColor | null; label: string }[] = [
  { value: null, label: 'Default' },
  { value: 'gray', label: 'Grey' },
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'pink', label: 'Pink' },
];

const HIGHLIGHTS: { value: Highlight | null; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'pink', label: 'Pink' },
  { value: 'purple', label: 'Purple' },
  { value: 'orange', label: 'Orange' },
];

const ALIGNS: { value: Align; label: string; icon: IconName }[] = [
  { value: 'left', label: 'Align left', icon: 'alignLeft' },
  { value: 'center', label: 'Centre', icon: 'alignCenter' },
  { value: 'right', label: 'Align right', icon: 'alignRight' },
  { value: 'justify', label: 'Justify', icon: 'alignJustify' },
];

const MARKS: { mark: ToggleMark; label: string; icon: IconName; keys: string }[] = [
  { mark: 'bold', label: 'Bold', icon: 'bold', keys: `${MOD}+B` },
  { mark: 'italic', label: 'Italic', icon: 'italic', keys: `${MOD}+I` },
  { mark: 'underline', label: 'Underline', icon: 'underline', keys: `${MOD}+U` },
  { mark: 'strike', label: 'Strikethrough', icon: 'strike', keys: `${MOD}+Shift+X` },
  { mark: 'code', label: 'Inline code', icon: 'code', keys: `${MOD}+E` },
];

const LISTS: { type: BlockType; label: string; icon: IconName; keys: string }[] = [
  { type: 'bullet', label: 'Bulleted list', icon: 'list', keys: `${MOD}+Shift+8 or type “- ”` },
  { type: 'ol', label: 'Numbered list', icon: 'listOrdered', keys: `${MOD}+Shift+7 or type “1. ”` },
  { type: 'todo', label: 'Checklist', icon: 'checklist', keys: `${MOD}+Shift+9 or type “[] ”` },
];

/**
 * Formatting toolbar for the note editor. Follows the ARIA toolbar pattern: one Tab stop,
 * arrow keys move between tools, Home/End jump to the ends. Buttons keep the editor's selection
 * (mousedown is cancelled) so commands apply to the selected text.
 */
@Component({
  selector: 'app-format-toolbar',
  imports: [Icon, MenuDirective, Tooltip],
  templateUrl: './format-toolbar.html',
  styleUrl: './format-toolbar.scss',
  host: {
    '(keydown)': 'onKeydown($event)',
    '(focusin)': 'onFocusIn($event)',
  },
})
export class FormatToolbar {
  readonly editor = input<BlockEditor | undefined>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly mod = MOD;
  protected readonly styles = STYLES;
  protected readonly colors = COLORS;
  protected readonly highlights = HIGHLIGHTS;
  protected readonly aligns = ALIGNS;
  protected readonly marks = MARKS;
  protected readonly lists = LISTS;

  protected readonly state = computed(() => this.editor()?.format());
  protected readonly styleLabel = computed(
    () => STYLES.find((s) => s.type === this.state()?.type)?.label ?? 'Body',
  );
  protected readonly alignIcon = computed<IconName>(
    () => ALIGNS.find((a) => a.value === (this.state()?.align ?? 'left'))?.icon ?? 'alignLeft',
  );
  protected readonly colorName = computed(
    () => COLORS.find((c) => c.value === (this.state()?.marks.color ?? null))?.label ?? 'Default',
  );
  protected readonly highlightName = computed(
    () =>
      HIGHLIGHTS.find((h) => h.value === (this.state()?.marks.highlight ?? null))?.label ?? 'None',
  );
  protected readonly size = computed(() => this.state()?.marks.size ?? 0);
  /** Lists, quotes and code blocks are always left-aligned. */
  protected readonly alignable = computed(() => ALIGNABLE.includes(this.state()?.type ?? 'p'));

  private active = 0;

  constructor() {
    afterNextRender(() => this.syncTabStops());
  }

  protected isList(type: BlockType): boolean {
    return this.state()?.type === type;
  }

  // ---- commands (each keeps focus where the user is) -----------------------------------
  protected undo(): void {
    if (this.editor()?.canUndo()) this.editor()?.undo();
  }

  protected redo(): void {
    if (this.editor()?.canRedo()) this.editor()?.redo();
  }

  protected setStyle(type: BlockType, menu: MenuDirective): void {
    menu.close();
    this.editor()?.setBlockType(type);
  }

  protected toggle(mark: ToggleMark): void {
    this.editor()?.toggleMark(mark);
  }

  protected resize(delta: 1 | -1): void {
    this.editor()?.changeSize(delta);
  }

  protected setColor(color: TextColor | null, menu: MenuDirective): void {
    menu.close();
    this.editor()?.setColor(color);
  }

  protected setHighlight(highlight: Highlight | null, menu: MenuDirective): void {
    menu.close();
    this.editor()?.setHighlight(highlight);
  }

  protected link(): void {
    this.editor()?.openLinkDialog();
  }

  protected list(type: BlockType): void {
    this.editor()?.setBlockType(type);
  }

  protected align(value: Align, menu: MenuDirective): void {
    menu.close();
    this.editor()?.setAlign(value);
  }

  protected image(): void {
    this.editor()?.pickImages();
  }

  protected clear(): void {
    this.editor()?.clearFormatting();
  }

  // ---- roving tabindex -------------------------------------------------------------
  private tools(): HTMLElement[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>('[data-tool]')];
  }

  private syncTabStops(): void {
    this.tools().forEach((el, i) => (el.tabIndex = i === this.active ? 0 : -1));
  }

  protected onFocusIn(event: FocusEvent): void {
    const index = this.tools().indexOf(event.target as HTMLElement);
    if (index >= 0) {
      this.active = index;
      this.syncTabStops();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const tools = this.tools();
    const index = tools.indexOf(event.target as HTMLElement);
    if (index < 0) return;
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % tools.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tools.length) % tools.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tools.length - 1;
    if (next < 0) return;
    event.preventDefault();
    this.active = next;
    this.syncTabStops();
    tools[next]?.focus();
  }
}
