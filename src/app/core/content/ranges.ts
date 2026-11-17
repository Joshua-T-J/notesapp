import {
  ALIGNABLE,
  Align,
  Block,
  BlockType,
  Highlight,
  MARK_KEYS,
  Marks,
  Span,
  TextColor,
  blockText,
  cleanSpan,
  normalizeSpans,
} from './blocks';

/** A position in the body: block index and character offset within that block's text. */
export interface TextPoint {
  block: number;
  offset: number;
}

/** `start` is never after `end`. */
export interface TextRange {
  start: TextPoint;
  end: TextPoint;
}

export function isCollapsed(r: TextRange): boolean {
  return r.start.block === r.end.block && r.start.offset === r.end.offset;
}

export function orderRange(a: TextPoint, b: TextPoint): TextRange {
  const aFirst = a.block < b.block || (a.block === b.block && a.offset <= b.offset);
  return aFirst ? { start: a, end: b } : { start: b, end: a };
}

/** Character range [from, to) of block `i` covered by `range`, or null when outside it. */
function slice(blocks: readonly Block[], range: TextRange, i: number): [number, number] | null {
  if (i < range.start.block || i > range.end.block) return null;
  const len = blockText(blocks[i]!).length;
  const from = i === range.start.block ? range.start.offset : 0;
  const to = i === range.end.block ? range.end.offset : len;
  return [Math.max(0, Math.min(from, len)), Math.max(0, Math.min(to, len))];
}

/** Spans of a block split so that [from, to) is covered by whole spans; `inside` marks them. */
function splitSpans(
  spans: readonly Span[],
  from: number,
  to: number,
): { span: Span; inside: boolean }[] {
  const out: { span: Span; inside: boolean }[] = [];
  let pos = 0;
  for (const span of spans) {
    const end = pos + span.text.length;
    const cuts = [pos, Math.max(pos, Math.min(from, end)), Math.max(pos, Math.min(to, end)), end];
    for (let k = 0; k < 3; k++) {
      const a = cuts[k]!;
      const b = cuts[k + 1]!;
      if (b > a)
        out.push({ span: { ...span, text: span.text.slice(a - pos, b - pos) }, inside: k === 1 });
    }
    pos = end;
  }
  return out;
}

/** Applies `change` to the marks of every character in `range`. */
export function updateMarks(
  blocks: readonly Block[],
  range: TextRange,
  change: (marks: Marks) => Marks,
): Block[] {
  return blocks.map((block, i) => {
    const s = slice(blocks, range, i);
    if (!s || block.type === 'image' || s[0] === s[1]) return block;
    const parts = splitSpans(block.spans, s[0], s[1]);
    const spans = parts.map(({ span, inside }) =>
      inside ? cleanSpan(span.text, change(span)) : span,
    );
    return { ...block, spans: normalizeSpans(spans) };
  });
}

/** Spans (pieces) inside a non-collapsed range. */
function piecesIn(blocks: readonly Block[], range: TextRange): Span[] {
  const out: Span[] = [];
  blocks.forEach((block, i) => {
    const s = slice(blocks, range, i);
    if (!s || block.type === 'image') return;
    for (const p of splitSpans(block.spans, s[0], s[1]))
      if (p.inside && p.span.text) out.push(p.span);
  });
  return out;
}

/** The span the caret sits in (the character before it, or after it at a block start). */
function spanAt(blocks: readonly Block[], point: TextPoint): Span | null {
  const block = blocks[point.block];
  if (!block || block.type === 'image') return null;
  let pos = 0;
  let found: Span | null = null;
  for (const span of block.spans) {
    const end = pos + span.text.length;
    if (point.offset > pos && point.offset <= end) return span;
    if (point.offset === 0 && pos === 0) found = span;
    pos = end;
  }
  return found;
}

export interface MarkState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  /** Shared value across the selection; `null` when none or mixed. */
  color: TextColor | null;
  highlight: Highlight | null;
  size: number;
  href: string | null;
}

/** What the toolbar should show for the current selection. */
export function marksIn(blocks: readonly Block[], range: TextRange): MarkState {
  const pieces = isCollapsed(range)
    ? [spanAt(blocks, range.start)].filter((s): s is Span => !!s)
    : piecesIn(blocks, range);
  const all = (key: 'bold' | 'italic' | 'underline' | 'strike' | 'code') =>
    pieces.length > 0 && pieces.every((p) => !!p[key]);
  const common = <K extends 'color' | 'highlight' | 'href' | 'size'>(key: K) => {
    const first = pieces[0]?.[key];
    return pieces.length > 0 && pieces.every((p) => p[key] === first) ? first : undefined;
  };
  return {
    bold: all('bold'),
    italic: all('italic'),
    underline: all('underline'),
    strike: all('strike'),
    code: all('code'),
    color: common('color') ?? null,
    highlight: common('highlight') ?? null,
    size: common('size') ?? 0,
    href: common('href') ?? null,
  };
}

/** The word around a collapsed caret, so formatting a caret formats the word it is in. */
export function wordAt(blocks: readonly Block[], point: TextPoint): TextRange | null {
  const block = blocks[point.block];
  if (!block || block.type === 'image') return null;
  const text = blockText(block);
  const isWord = (ch: string | undefined) => !!ch && /[\p{L}\p{N}_'’-]/u.test(ch);
  let a = point.offset;
  let b = point.offset;
  while (a > 0 && isWord(text[a - 1])) a--;
  while (b < text.length && isWord(text[b])) b++;
  return a === b
    ? null
    : { start: { block: point.block, offset: a }, end: { block: point.block, offset: b } };
}

export function clearMarks(blocks: readonly Block[], range: TextRange): Block[] {
  return updateMarks(blocks, range, () => ({}));
}

export function hasAnyMark(span: Span): boolean {
  return MARK_KEYS.some((k) => span[k] !== undefined && span[k] !== false);
}

// ---------------------------------------------------------------------------
// Block-level changes
// ---------------------------------------------------------------------------

export interface BlocksResult {
  blocks: Block[];
  range: TextRange;
}

/**
 * Turns the blocks touched by `range` into `type`. Choosing the type they already have turns
 * them back into paragraphs. Several lines become one code block, and a code block turned
 * into anything else becomes one block per line.
 */
export function setBlockTypes(
  blocks: readonly Block[],
  range: TextRange,
  type: BlockType,
): BlocksResult {
  const first = range.start.block;
  const last = range.end.block;
  const targets = blocks.slice(first, last + 1);
  const textual = targets.filter((b) => b.type !== 'image');
  if (!textual.length) return { blocks: [...blocks], range };
  const target: BlockType = type !== 'p' && textual.every((b) => b.type === type) ? 'p' : type;

  let replaced: Block[];
  if (target === 'code') {
    const text = textual.map(blockText).join('\n');
    replaced = [{ type: 'code', spans: text ? [{ text }] : [] }];
  } else {
    replaced = targets.flatMap((b): Block[] => {
      if (b.type === 'image') return [b];
      if (b.type === 'code') {
        return blockText(b)
          .split('\n')
          .map((line) => ({
            type: target,
            spans: line ? [{ text: line }] : [],
            ...(target === 'todo' ? { checked: false } : {}),
          }));
      }
      const next: Block = { type: target, spans: b.spans };
      if (b.align && ALIGNABLE.includes(target)) next.align = b.align;
      if (target === 'todo') next.checked = b.type === 'todo' ? !!b.checked : false;
      return [next];
    });
  }

  const out = [...blocks.slice(0, first), ...replaced, ...blocks.slice(last + 1)];
  const endBlock = first + replaced.length - 1;
  const sameShape = replaced.length === targets.length;
  return {
    blocks: out,
    range: sameShape
      ? range
      : {
          start: { block: first, offset: 0 },
          end: { block: endBlock, offset: blockText(replaced.at(-1)!).length },
        },
  };
}

export function setAlign(blocks: readonly Block[], range: TextRange, align: Align): Block[] {
  return blocks.map((b, i) => {
    if (i < range.start.block || i > range.end.block || !ALIGNABLE.includes(b.type)) return b;
    const next: Block = { ...b };
    if (align === 'left') delete next.align;
    else next.align = align;
    return next;
  });
}
