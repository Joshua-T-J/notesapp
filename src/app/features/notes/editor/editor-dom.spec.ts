import { Block } from '../../../core/content/blocks';
import {
  applyShortcut,
  getSelectionRange,
  parseBlocks,
  renderBlocks,
  setBlockType,
  setSelectionRange,
  splitBlock,
} from './editor-dom';

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.append(el);
  return el;
}

describe('editor-dom', () => {
  const sample: Block[] = [
    { type: 'h2', spans: [{ text: 'Title' }] },
    {
      type: 'p',
      spans: [
        { text: 'Hello ' },
        { text: 'bold', bold: true },
        { text: ' and ' },
        { text: 'both', bold: true, italic: true },
      ],
    },
    { type: 'todo', checked: true, spans: [{ text: 'Done' }] },
    { type: 'todo', checked: false, spans: [{ text: 'Open' }] },
    { type: 'bullet', spans: [{ text: 'line one\nline two' }] },
    { type: 'p', spans: [] },
  ];

  it('round-trips blocks through the DOM', () => {
    const el = root();
    renderBlocks(el, sample);
    expect(parseBlocks(el)).toEqual(sample);
  });

  it('never interprets text as HTML', () => {
    const el = root();
    renderBlocks(el, [{ type: 'p', spans: [{ text: '<img src=x onerror=alert(1)>' }] }]);
    expect(el.querySelector('img')).toBeNull();
    expect(parseBlocks(el)[0]?.spans[0]?.text).toBe('<img src=x onerror=alert(1)>');
  });

  it('reads pasted/foreign markup sensibly', () => {
    const el = root();
    const ul = document.createElement('ul');
    for (const t of ['a', 'b']) {
      const li = document.createElement('li');
      li.textContent = t;
      ul.append(li);
    }
    el.append(document.createTextNode('loose'), ul);
    expect(parseBlocks(el)).toEqual([
      { type: 'p', spans: [{ text: 'loose' }] },
      { type: 'bullet', spans: [{ text: 'a' }] },
      { type: 'bullet', spans: [{ text: 'b' }] },
    ]);
  });

  it('splits a checklist item into a new unchecked item', () => {
    const el = root();
    renderBlocks(el, [{ type: 'todo', checked: true, spans: [{ text: 'HelloWorld' }] }]);
    const block = el.firstElementChild as HTMLElement;
    const range = document.createRange();
    range.setStart(block.firstChild!, 5);
    const next = splitBlock(block, range);
    expect(next.dataset['checked']).toBe('false');
    expect(parseBlocks(el)).toEqual([
      { type: 'todo', checked: true, spans: [{ text: 'Hello' }] },
      { type: 'todo', checked: false, spans: [{ text: 'World' }] },
    ]);
  });

  it('turns "- " and "[] " into list blocks', () => {
    const el = root();
    renderBlocks(el, [{ type: 'p', spans: [{ text: '[] buy milk' }] }]);
    applyShortcut(el.firstElementChild as HTMLElement);
    expect(parseBlocks(el)).toEqual([
      { type: 'todo', checked: false, spans: [{ text: 'buy milk' }] },
    ]);
  });

  it('changes block type and keeps content', () => {
    const el = root();
    renderBlocks(el, [{ type: 'p', spans: [{ text: 'x', italic: true }] }]);
    setBlockType(el.firstElementChild as HTMLElement, 'h3');
    expect(parseBlocks(el)).toEqual([{ type: 'h3', spans: [{ text: 'x', italic: true }] }]);
  });

  it('round-trips every mark and block type', () => {
    const el = root();
    const rich: Block[] = [
      {
        type: 'p',
        align: 'center',
        spans: [
          { text: 'a', underline: true },
          { text: 'b', strike: true },
          { text: 'c', code: true },
        ],
      },
      {
        type: 'p',
        spans: [
          { text: 'col', color: 'red', size: 2 },
          { text: 'hl', highlight: 'yellow', bold: true },
          { text: 'ln', href: 'https://e.com/' },
        ],
      },
      { type: 'ol', spans: [{ text: 'one' }] },
      { type: 'quote', spans: [{ text: 'q' }] },
      { type: 'h2', align: 'right', spans: [{ text: 'h' }] },
      { type: 'code', spans: [{ text: 'x\ny' }] },
      { type: 'image', spans: [], image: { assetId: 'img1', alt: 'Cat', width: 'sm' } },
      { type: 'p', spans: [{ text: 'after' }] },
    ];
    renderBlocks(el, rich);
    expect(parseBlocks(el)).toEqual(rich);
  });

  it('never renders unsafe link schemes', () => {
    const el = root();
    renderBlocks(el, [{ type: 'p', spans: [{ text: 'x', href: 'javascript:alert(1)' }] }]);
    expect(el.querySelector('a')).toBeNull();
  });

  it('maps the selection to model offsets and back', () => {
    const el = root();
    renderBlocks(el, [
      { type: 'p', spans: [{ text: 'Hello ' }, { text: 'bold', bold: true }, { text: ' end' }] },
      { type: 'p', spans: [{ text: 'line one\nline two' }] },
    ]);
    const range = { start: { block: 0, offset: 7 }, end: { block: 1, offset: 12 } };
    setSelectionRange(el, range);
    expect(getSelectionRange(el)).toEqual(range);
  });

  it('turns "1. " and "> " into numbered and quote blocks', () => {
    const el = root();
    renderBlocks(el, [
      { type: 'p', spans: [{ text: '1. first' }] },
      { type: 'p', spans: [{ text: '> said' }] },
    ]);
    applyShortcut(el.children[0] as HTMLElement);
    applyShortcut(el.children[1] as HTMLElement);
    expect(parseBlocks(el)).toEqual([
      { type: 'ol', spans: [{ text: 'first' }] },
      { type: 'quote', spans: [{ text: 'said' }] },
    ]);
  });
});
