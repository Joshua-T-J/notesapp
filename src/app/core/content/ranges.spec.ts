import { Block } from './blocks';
import { marksIn, setAlign, setBlockTypes, updateMarks, wordAt } from './ranges';

const doc: Block[] = [
  { type: 'p', spans: [{ text: 'Hello ' }, { text: 'world', bold: true }] },
  { type: 'p', spans: [{ text: 'Second line' }] },
];

describe('ranges', () => {
  it('applies a mark across part of one block, splitting spans', () => {
    const out = updateMarks(
      doc,
      { start: { block: 0, offset: 2 }, end: { block: 0, offset: 8 } },
      (m) => ({ ...m, highlight: 'yellow' }),
    );
    expect(out[0]?.spans).toEqual([
      { text: 'He' },
      { text: 'llo ', highlight: 'yellow' },
      { text: 'wo', bold: true, highlight: 'yellow' },
      { text: 'rld', bold: true },
    ]);
  });

  it('applies a mark across blocks', () => {
    const out = updateMarks(
      doc,
      { start: { block: 0, offset: 6 }, end: { block: 1, offset: 6 } },
      (m) => ({ ...m, color: 'blue' }),
    );
    expect(out[0]?.spans.at(-1)).toEqual({ text: 'world', bold: true, color: 'blue' });
    expect(out[1]?.spans).toEqual([{ text: 'Second', color: 'blue' }, { text: ' line' }]);
  });

  it('reports shared marks for the toolbar', () => {
    expect(
      marksIn(doc, { start: { block: 0, offset: 7 }, end: { block: 0, offset: 9 } }).bold,
    ).toBe(true);
    expect(
      marksIn(doc, { start: { block: 0, offset: 0 }, end: { block: 0, offset: 9 } }).bold,
    ).toBe(false);
    expect(
      marksIn(doc, { start: { block: 0, offset: 8 }, end: { block: 0, offset: 8 } }).bold,
    ).toBe(true);
  });

  it('finds the word at the caret', () => {
    expect(wordAt(doc, { block: 1, offset: 3 })).toEqual({
      start: { block: 1, offset: 0 },
      end: { block: 1, offset: 6 },
    });
    expect(wordAt(doc, { block: 0, offset: 6 })).toEqual({
      start: { block: 0, offset: 6 },
      end: { block: 0, offset: 11 },
    });
  });

  it('toggles block types and merges lines into one code block', () => {
    const all = { start: { block: 0, offset: 0 }, end: { block: 1, offset: 3 } };
    const ol = setBlockTypes(doc, all, 'ol');
    expect(ol.blocks.map((b) => b.type)).toEqual(['ol', 'ol']);
    expect(setBlockTypes(ol.blocks, all, 'ol').blocks.map((b) => b.type)).toEqual(['p', 'p']);

    const code = setBlockTypes(doc, all, 'code');
    expect(code.blocks).toEqual([{ type: 'code', spans: [{ text: 'Hello world\nSecond line' }] }]);
    const back = setBlockTypes(
      code.blocks,
      { start: { block: 0, offset: 0 }, end: { block: 0, offset: 0 } },
      'p',
    );
    expect(back.blocks.map((b) => b.spans[0]?.text)).toEqual(['Hello world', 'Second line']);
  });

  it('sets and clears alignment', () => {
    const r = { start: { block: 1, offset: 0 }, end: { block: 1, offset: 0 } };
    const centred = setAlign(doc, r, 'center');
    expect(centred[1]?.align).toBe('center');
    expect('align' in setAlign(centred, r, 'left')[1]!).toBe(false);
  });
});
