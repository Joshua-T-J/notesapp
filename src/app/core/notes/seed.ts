import { Block, markSpan } from '../content/blocks';
import { Workspace, WORKSPACE_VERSION } from './note.model';

const t = (text: string): Block => ({ type: 'p', spans: [{ text }] });

/** First-run content: short, useful, and easy to delete. */
export function createSeedWorkspace(now: number, newId: () => string): Workspace {
  const ideas = newId();
  return {
    version: WORKSPACE_VERSION,
    folders: [{ id: ideas, name: 'Ideas', color: 1, createdAt: now, updatedAt: now }],
    notes: [
      {
        id: newId(),
        title: 'Welcome to Nota',
        folderId: null,
        tags: [],
        pinned: true,
        locked: false,
        trashedAt: null,
        createdAt: now,
        updatedAt: now,
        body: [
          {
            type: 'p',
            spans: [
              {
                text: 'Your notes are saved in this browser as you type. Nothing is sent anywhere. ',
              },
              markSpan('Export', true, false),
              { text: ' any note as Markdown from the top bar.' },
            ],
          },
          { type: 'h2', spans: [{ text: 'Try it' }] },
          { type: 'todo', checked: true, spans: [{ text: 'Open this note' }] },
          { type: 'todo', spans: [{ text: 'Tick this box' }] },
          {
            type: 'todo',
            spans: [
              { text: 'Select some text and try the toolbar: colours, highlights, links, sizes' },
            ],
          },
          {
            type: 'todo',
            spans: [
              {
                text: 'Start a line with "- ", "1. ", "[] " or "> " for lists, checklists and quotes',
              },
            ],
          },
          { type: 'todo', spans: [{ text: 'Back up your notes from Settings now and then' }] },
        ],
      },
      {
        id: newId(),
        title: 'A note in a folder',
        folderId: ideas,
        tags: ['example'],
        pinned: false,
        locked: false,
        trashedAt: null,
        createdAt: now - 60_000,
        updatedAt: now - 60_000,
        body: [
          t('Folders and tags are optional. Use the folder menu at the top of a note to move it.'),
          {
            type: 'bullet',
            spans: [{ text: 'Lock a note to hide its text until you choose to show it.' }],
          },
          {
            type: 'bullet',
            spans: [{ text: 'Locking is not encryption, so keep passwords elsewhere.' }],
          },
        ],
      },
    ],
  };
}
