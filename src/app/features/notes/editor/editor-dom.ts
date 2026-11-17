import {
  ALIGNABLE,
  Block,
  BlockType,
  HIGHLIGHTS,
  Highlight,
  Marks,
  SAFE_HREF,
  Span,
  TEXT_COLORS,
  TextColor,
  cleanSpan,
  normalizeSpans,
} from '../../../core/content/blocks';
import { TextPoint, TextRange, orderRange } from '../../../core/content/ranges';

/**
 * DOM helpers for the note editor (a contenteditable element whose direct children are blocks).
 * Text only ever enters the DOM through text nodes and the elements created here — never as HTML.
 *
 *   p, h2, h3 → <p>, <h2>, <h3>        quote → <blockquote>     code → <pre>
 *   bullet / ol / todo → <div data-type="…">  (todo also data-checked)
 *   image → <figure data-type="image" contenteditable="false"> with an <img> and its tools
 *   Any block may carry data-align="center|right|justify".
 *
 * Inline marks nest in a fixed order: a > mark[data-hl] > span[data-color|data-size] > strong >
 * em > u > s > code > text.
 */

// ---------------------------------------------------------------------------
// Rendering (blocks → DOM)
// ---------------------------------------------------------------------------

export function createBlockElement(doc: Document, block: Block): HTMLElement {
  if (block.type === 'image') return createFigure(doc, block);
  const el = shell(doc, block.type, !!block.checked);
  if (block.align && block.align !== 'left' && ALIGNABLE.includes(block.type))
    el.dataset['align'] = block.align;
  for (const span of block.spans) el.append(spanNode(doc, span));
  ensurePlaceholder(el);
  return el;
}

export function renderBlocks(root: HTMLElement, blocks: readonly Block[]): void {
  const doc = root.ownerDocument;
  const list = blocks.length ? blocks : [{ type: 'p' as const, spans: [] }];
  root.replaceChildren(...list.map((b) => createBlockElement(doc, b)));
  // A caret cannot be placed after an image at the very end; keep a paragraph there.
  if (root.lastElementChild?.getAttribute('data-type') === 'image') {
    root.append(createBlockElement(doc, { type: 'p', spans: [] }));
  }
}

function shell(doc: Document, type: BlockType, checked: boolean): HTMLElement {
  switch (type) {
    case 'h2':
    case 'h3':
      return doc.createElement(type);
    case 'quote':
      return doc.createElement('blockquote');
    case 'code': {
      const pre = doc.createElement('pre');
      pre.spellcheck = false;
      return pre;
    }
    case 'bullet':
    case 'ol':
    case 'todo': {
      const el = doc.createElement('div');
      el.dataset['type'] = type;
      if (type === 'todo') el.dataset['checked'] = String(checked);
      return el;
    }
    default:
      return doc.createElement('p');
  }
}

function wrap(
  doc: Document,
  tag: string,
  child: Node,
  attrs: Record<string, string> = {},
): HTMLElement {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(child);
  return el;
}

function spanNode(doc: Document, span: Span): Node {
  const frag = doc.createDocumentFragment();
  span.text.split('\n').forEach((part, i) => {
    if (i > 0) frag.append(doc.createElement('br'));
    if (part) frag.append(doc.createTextNode(part));
  });
  let node: Node = frag;
  if (span.code) node = wrap(doc, 'code', node);
  if (span.strike) node = wrap(doc, 's', node);
  if (span.underline) node = wrap(doc, 'u', node);
  if (span.italic) node = wrap(doc, 'em', node);
  if (span.bold) node = wrap(doc, 'strong', node);
  if (span.color || span.size) {
    const attrs: Record<string, string> = {};
    if (span.color) attrs['data-color'] = span.color;
    if (span.size) attrs['data-size'] = String(span.size);
    node = wrap(doc, 'span', node, attrs);
  }
  if (span.highlight) node = wrap(doc, 'mark', node, { 'data-hl': span.highlight });
  if (span.href && SAFE_HREF.test(span.href)) {
    node = wrap(doc, 'a', node, {
      href: span.href,
      rel: 'noopener noreferrer nofollow',
      target: '_blank',
    });
  }
  return node;
}

/** Image block: the picture plus a small toolbar, outside the editable text flow. */
function createFigure(doc: Document, block: Block): HTMLElement {
  const image = block.image!;
  const fig = doc.createElement('figure');
  fig.dataset['type'] = 'image';
  fig.dataset['asset'] = image.assetId;
  fig.dataset['width'] = image.width;
  if (block.align && block.align !== 'left') fig.dataset['align'] = block.align;
  fig.contentEditable = 'false';
  fig.tabIndex = 0;
  fig.setAttribute('role', 'group');
  fig.setAttribute('aria-label', image.alt ? `Image: ${image.alt}` : 'Image without a description');

  const img = doc.createElement('img');
  img.alt = image.alt;
  img.decoding = 'async';
  img.draggable = false;
  fig.append(img);

  const tools = doc.createElement('div');
  tools.className = 'figure-tools';
  tools.setAttribute('role', 'toolbar');
  tools.setAttribute('aria-label', 'Image');
  const button = (action: string, text: string, label: string, pressed?: boolean) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.dataset['action'] = action;
    b.textContent = text;
    b.setAttribute('aria-label', label);
    if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
    tools.append(b);
  };
  button(
    'alt',
    image.alt ? 'Edit description' : 'Add description',
    image.alt ? 'Edit image description' : 'Add image description',
  );
  button('width:sm', 'S', 'Small', image.width === 'sm');
  button('width:md', 'M', 'Medium', image.width === 'md');
  button('width:full', 'L', 'Full width', image.width === 'full');
  button('remove', 'Remove', 'Remove image');
  fig.append(tools);
  return fig;
}

/** An empty block needs a <br> to keep its height and accept the caret. */
export function ensurePlaceholder(el: HTMLElement): void {
  if (el.dataset['type'] === 'image') return;
  if (!el.textContent && !el.querySelector('br')) el.append(el.ownerDocument.createElement('br'));
  // A trailing line break also needs a placeholder <br> after it to be visible.
  const last = el.lastChild;
  if (last?.nodeType === 3 && last.textContent?.endsWith('\n'))
    el.append(el.ownerDocument.createElement('br'));
}

// ---------------------------------------------------------------------------
// Walking a block's text (shared by parsing and caret mapping, so offsets always agree)
// ---------------------------------------------------------------------------

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'FIGURE',
]);

interface Piece {
  node: Node;
  /** Text this piece contributes (a <br> or nested block boundary counts as "\n"). */
  text: string;
  marks: Marks;
}

const isColor = (v: string | undefined): v is TextColor =>
  !!v && (TEXT_COLORS as readonly string[]).includes(v);
const isHighlight = (v: string | undefined): v is Highlight =>
  !!v && (HIGHLIGHTS as readonly string[]).includes(v);

function marksOf(el: HTMLElement, inherited: Marks): Marks {
  const m: Marks = { ...inherited };
  const tag = el.tagName;
  const weight = el.style?.fontWeight;
  if (tag === 'B' || tag === 'STRONG' || weight === 'bold' || Number(weight) >= 600) m.bold = true;
  if (tag === 'I' || tag === 'EM' || el.style?.fontStyle === 'italic') m.italic = true;
  if (tag === 'U' || el.style?.textDecorationLine?.includes('underline')) m.underline = true;
  if (
    tag === 'S' ||
    tag === 'STRIKE' ||
    tag === 'DEL' ||
    el.style?.textDecorationLine?.includes('line-through')
  )
    m.strike = true;
  if (tag === 'CODE') m.code = true;
  const color = el.dataset?.['color'];
  if (isColor(color)) m.color = color;
  const size = Number(el.dataset?.['size']);
  if (Number.isInteger(size) && size !== 0) m.size = size;
  const hl = el.dataset?.['hl'];
  if (tag === 'MARK' && isHighlight(hl)) m.highlight = hl;
  if (tag === 'A') {
    const href = el.getAttribute('href') ?? '';
    if (SAFE_HREF.test(href)) m.href = href;
  }
  return m;
}

function* walk(node: Node, marks: Marks, first: { value: boolean }): Generator<Piece> {
  if (node.nodeType === 3) {
    const text = (node.textContent ?? '').replace(/ /g, ' ').replace(/​/g, '');
    first.value = false;
    yield { node, text, marks };
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as HTMLElement;
  if (el.tagName === 'BR') {
    first.value = false;
    yield { node, text: '\n', marks };
    return;
  }
  if (BLOCK_TAGS.has(el.tagName) && !first.value) yield { node, text: '\n', marks };
  const inner = marksOf(el, marks);
  for (const child of Array.from(el.childNodes)) yield* walk(child, inner, first);
}

function piecesOf(blockEl: Element): Piece[] {
  const first = { value: true };
  const out: Piece[] = [];
  for (const child of Array.from(blockEl.childNodes)) out.push(...walk(child, {}, first));
  return out;
}

// ---------------------------------------------------------------------------
// Parsing (DOM → blocks)
// ---------------------------------------------------------------------------

export function blockTypeOf(el: Element): BlockType {
  const dataType = (el as HTMLElement).dataset?.['type'];
  if (dataType === 'bullet' || dataType === 'todo' || dataType === 'ol' || dataType === 'image')
    return dataType;
  switch (el.tagName) {
    case 'H1':
    case 'H2':
      return 'h2';
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return 'h3';
    case 'BLOCKQUOTE':
      return 'quote';
    case 'PRE':
      return 'code';
    case 'LI':
      return el.parentElement?.tagName === 'OL' ? 'ol' : 'bullet';
    default:
      return 'p';
  }
}

export function parseBlocks(root: HTMLElement): Block[] {
  const blocks: Block[] = [];
  let loose: Span[] = [];
  const flushLoose = () => {
    const spans = normalizeSpans(loose);
    if (spans.some((s) => s.text.trim())) blocks.push({ type: 'p', spans });
    loose = [];
  };

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === 1 && ['UL', 'OL'].includes((node as Element).tagName)) {
      flushLoose();
      for (const li of Array.from((node as Element).children)) blocks.push(parseBlock(li));
    } else if (node.nodeType === 1 && BLOCK_TAGS.has((node as Element).tagName)) {
      flushLoose();
      const block = parseBlock(node as Element);
      if (block.type !== 'image' || block.image) blocks.push(block);
    } else if (node.nodeType === 1 && (node as Element).tagName === 'BR') {
      flushLoose();
    } else {
      for (const p of walk(node, {}, { value: false }))
        if (p.text) loose.push(cleanSpan(p.text, p.marks));
    }
  }
  flushLoose();
  // The paragraph kept after a trailing image is only there for the caret.
  const last = blocks.at(-1);
  if (last && last.type === 'p' && !last.spans.length && blocks.at(-2)?.type === 'image')
    blocks.pop();
  return blocks;
}

function parseBlock(el: Element): Block {
  const type = blockTypeOf(el);
  const html = el as HTMLElement;
  const align = html.dataset?.['align'];
  if (type === 'image') {
    const assetId = html.dataset['asset'] ?? '';
    const width = html.dataset['width'];
    const block: Block = {
      type: 'image',
      spans: [],
      image: {
        assetId,
        alt: el.querySelector('img')?.getAttribute('alt') ?? '',
        width: width === 'sm' || width === 'full' ? width : 'md',
      },
    };
    if (align === 'center' || align === 'right') block.align = align;
    return assetId ? block : { type: 'p', spans: [] };
  }
  const pieces = piecesOf(el);
  // A trailing <br> is the browser's placeholder, not content.
  if (pieces.at(-1)?.node.nodeName === 'BR') pieces.pop();
  const block: Block = {
    type,
    spans: normalizeSpans(pieces.map((p) => cleanSpan(p.text, p.marks))),
  };
  if (type === 'todo') block.checked = html.dataset['checked'] === 'true';
  if ((align === 'center' || align === 'right' || align === 'justify') && ALIGNABLE.includes(type))
    block.align = align;
  return block;
}

// ---------------------------------------------------------------------------
// Caret ⇄ model positions
// ---------------------------------------------------------------------------

/** The direct child of `root` that contains `node`, if any. */
export function blockElementOf(root: HTMLElement, node: Node | null): HTMLElement | null {
  let current: Node | null = node;
  while (current && current.parentNode !== root) current = current.parentNode;
  return current && current.nodeType === 1 ? (current as HTMLElement) : null;
}

/** Character offset of a DOM position (container, offset) inside a block element. */
function offsetIn(blockEl: Element, container: Node, offset: number): number {
  const point = blockEl.ownerDocument.createRange();
  point.setStart(container, offset);
  point.collapse(true);
  let pos = 0;
  for (const p of piecesOf(blockEl)) {
    if (p.node.nodeType === 3) {
      if (p.node === container) return pos + Math.min(offset, p.text.length);
      // Whole text node before the caret?
      if (point.comparePoint(p.node, (p.node as Text).length) <= 0) pos += p.text.length;
      else return pos;
    } else if (p.node.nodeName === 'BR') {
      const parent = p.node.parentNode!;
      const index = Array.prototype.indexOf.call(parent.childNodes, p.node);
      if (point.comparePoint(parent, index + 1) <= 0) pos += 1;
      else return pos;
    } else {
      // Boundary before a nested block element.
      if (point.comparePoint(p.node, 0) <= 0) pos += 1;
      else return pos;
    }
  }
  return pos;
}

export function pointFromDom(root: HTMLElement, node: Node, offset: number): TextPoint | null {
  if (node === root) {
    const blocks = root.children;
    if (!blocks.length) return null;
    const child = root.childNodes[offset];
    if (!child) {
      const last = blocks.length - 1;
      return {
        block: last,
        offset: offsetIn(blocks[last]!, blocks[last]!, blocks[last]!.childNodes.length),
      };
    }
    const el = child.nodeType === 1 ? (child as Element) : child.nextSibling;
    const index = el ? Array.prototype.indexOf.call(blocks, el) : -1;
    return { block: index >= 0 ? index : blocks.length - 1, offset: 0 };
  }
  const blockEl = blockElementOf(root, node);
  if (!blockEl) return null;
  const index = Array.prototype.indexOf.call(root.children, blockEl);
  if (blockEl.dataset['type'] === 'image') return { block: index, offset: 0 };
  return { block: index, offset: offsetIn(blockEl, node, offset) };
}

export function getSelectionRange(root: HTMLElement): TextRange | null {
  const sel = root.ownerDocument.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode) return null;
  if (!root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) return null;
  const a = pointFromDom(root, sel.anchorNode, sel.anchorOffset);
  const b = pointFromDom(root, sel.focusNode, sel.focusOffset);
  return a && b ? orderRange(a, b) : null;
}

/** DOM position for a model position. */
function domPoint(root: HTMLElement, point: TextPoint): [Node, number] | null {
  const blockEl = root.children[Math.min(point.block, root.children.length - 1)];
  if (!blockEl) return null;
  if ((blockEl as HTMLElement).dataset['type'] === 'image')
    return [root, Array.prototype.indexOf.call(root.childNodes, blockEl)];
  let pos = 0;
  let lastText: Node | null = null;
  for (const p of piecesOf(blockEl)) {
    if (p.node.nodeType === 3) {
      if (point.offset <= pos + p.text.length) return [p.node, point.offset - pos];
      lastText = p.node;
    } else if (p.text && point.offset <= pos) {
      return [
        p.node.parentNode!,
        Array.prototype.indexOf.call(p.node.parentNode!.childNodes, p.node),
      ];
    }
    pos += p.text.length;
  }
  if (lastText) return [lastText, lastText.textContent?.length ?? 0];
  return [blockEl, 0];
}

export function setSelectionRange(root: HTMLElement, range: TextRange): void {
  const sel = root.ownerDocument.getSelection();
  const a = domPoint(root, range.start);
  const b = domPoint(root, range.end);
  if (!sel || !a || !b) return;
  const r = root.ownerDocument.createRange();
  r.setStart(a[0], a[1]);
  r.setEnd(b[0], b[1]);
  sel.removeAllRanges();
  sel.addRange(r);
}

// ---------------------------------------------------------------------------
// Editing operations on the DOM (used for typing-speed actions like Enter)
// ---------------------------------------------------------------------------

/** Block elements touched by a DOM range, in order. */
export function blocksInRange(root: HTMLElement, range: Range): HTMLElement[] {
  const start = blockElementOf(
    root,
    range.startContainer === root
      ? (root.childNodes[range.startOffset] ?? null)
      : range.startContainer,
  );
  const end = blockElementOf(
    root,
    range.endContainer === root
      ? (root.childNodes[Math.max(0, range.endOffset - 1)] ?? null)
      : range.endContainer,
  );
  if (!start) return [];
  const out: HTMLElement[] = [];
  for (let el: Element | null = start; el; el = el.nextElementSibling) {
    out.push(el as HTMLElement);
    if (el === end) break;
  }
  return out;
}

/** Changes a block's type in place, keeping its content and alignment. */
export function setBlockType(el: HTMLElement, type: BlockType, checked = false): HTMLElement {
  if (blockTypeOf(el) === type) {
    if (type === 'todo' && el.dataset['checked'] === undefined)
      el.dataset['checked'] = String(checked);
    return el;
  }
  const next = shell(el.ownerDocument, type, checked);
  if (el.dataset['align'] && ALIGNABLE.includes(type)) next.dataset['align'] = el.dataset['align'];
  next.append(...Array.from(el.childNodes));
  ensurePlaceholder(next);
  el.replaceWith(next);
  return next;
}

/** Type for the block created by Enter at the end of a block of `type`. */
export function continuationType(type: BlockType): BlockType {
  return type === 'bullet' || type === 'todo' || type === 'ol' || type === 'quote' ? type : 'p';
}

/**
 * Splits `el` at `range` (collapsed) the way Enter should: the text after the caret moves to a new
 * block inserted after it. Returns the new block.
 */
export function splitBlock(el: HTMLElement, range: Range): HTMLElement {
  const doc = el.ownerDocument;
  const tail = doc.createRange();
  tail.setStart(range.startContainer, range.startOffset);
  tail.setEnd(el, el.childNodes.length);
  const fragment = tail.extractContents();
  const type = blockTypeOf(el);
  const heading = type === 'h2' || type === 'h3';
  // Enter at the very start of a heading keeps the heading below and leaves an empty line above.
  if (!el.textContent && heading) {
    const para = setBlockType(el, 'p');
    const next = shell(doc, type, false);
    next.append(fragment);
    stripTrailingBreak(next);
    ensurePlaceholder(next);
    ensurePlaceholder(para);
    para.after(next);
    return next;
  }
  const nextType = continuationType(type);
  const next = shell(doc, nextType, false);
  if (el.dataset['align'] && ALIGNABLE.includes(nextType))
    next.dataset['align'] = el.dataset['align'];
  next.append(fragment);
  stripTrailingBreak(next);
  ensurePlaceholder(next);
  ensurePlaceholder(el);
  el.after(next);
  return next;
}

function stripTrailingBreak(el: HTMLElement): void {
  if (el.textContent && el.lastChild?.nodeName === 'BR') el.lastChild.remove();
}

export function caretAtStart(el: HTMLElement, range: Range): boolean {
  const before = el.ownerDocument.createRange();
  before.setStart(el, 0);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length === 0;
}

export function caretAtEnd(el: HTMLElement, range: Range): boolean {
  const after = el.ownerDocument.createRange();
  after.setStart(range.endContainer, range.endOffset);
  after.setEnd(el, el.childNodes.length);
  return after.toString().length === 0;
}

export function placeCaret(el: HTMLElement, atEnd: boolean): void {
  const selection = el.ownerDocument.getSelection();
  if (!selection) return;
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  range.collapse(!atEnd);
  if (atEnd && el.lastChild?.nodeName === 'BR') {
    range.setStartBefore(el.lastChild);
    range.collapse(true);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Markdown-style shortcuts typed at the start of a paragraph. */
const SHORTCUTS: [RegExp, BlockType, boolean][] = [
  [/^\[\s?\]\s/, 'todo', false],
  [/^\[[xX]\]\s/, 'todo', true],
  [/^[-*]\s/, 'bullet', false],
  [/^1[.)]\s/, 'ol', false],
  [/^>\s/, 'quote', false],
  [/^```$/, 'code', false],
  [/^##\s/, 'h3', false],
  [/^#\s/, 'h2', false],
];

/** Applies a typed shortcut ("- ", "1. ", "> ", "[] ", "# ", "```") to a paragraph. */
export function applyShortcut(el: HTMLElement): HTMLElement | null {
  if (blockTypeOf(el) !== 'p') return null;
  const text = (el.textContent ?? '').replace(/ /g, ' ');
  for (const [pattern, type, checked] of SHORTCUTS) {
    const match = pattern.exec(text);
    if (!match) continue;
    removeLeadingChars(el, match[0].length);
    const next = setBlockType(el, type, checked);
    ensurePlaceholder(next);
    return next;
  }
  return null;
}

function removeLeadingChars(el: HTMLElement, count: number): void {
  const walker = el.ownerDocument.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  let remaining = count;
  while (remaining > 0) {
    const node = walker.nextNode() as Text | null;
    if (!node) break;
    const take = Math.min(remaining, node.data.length);
    node.deleteData(0, take);
    remaining -= take;
  }
}

/** Wraps stray text/inline nodes sitting directly in the root into a paragraph. */
export function wrapLooseNodes(root: HTMLElement): HTMLElement | null {
  let wrapped: HTMLElement | null = null;
  for (const node of Array.from(root.childNodes)) {
    const isBlock =
      node.nodeType === 1 &&
      (BLOCK_TAGS.has((node as Element).tagName) ||
        ['UL', 'OL'].includes((node as Element).tagName));
    if (isBlock) {
      wrapped = null;
      continue;
    }
    if (node.nodeType === 3 && !node.textContent) {
      node.remove();
      continue;
    }
    if (!wrapped) {
      wrapped = root.ownerDocument.createElement('p');
      node.before(wrapped);
    }
    wrapped.append(node);
  }
  return wrapped;
}
