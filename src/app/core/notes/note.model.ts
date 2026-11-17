import { Block } from '../content/blocks';

/** Index into the `--folder-N` colour tokens. */
export type FolderColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const FOLDER_COLORS: readonly FolderColor[] = [1, 2, 3, 4, 5, 6, 7, 8];
export const FOLDER_COLOR_NAMES: Record<FolderColor, string> = {
  1: 'Slate',
  2: 'Plum',
  3: 'Clay',
  4: 'Olive',
  5: 'Sand',
  6: 'Teal',
  7: 'Rose',
  8: 'Graphite',
};

/** A chosen colour, or `random` to let the app pick one. */
export type FolderColorChoice = FolderColor | 'random';

export interface Folder {
  id: string;
  name: string;
  color: FolderColor;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  title: string;
  /** `null` = no folder. Folders are referenced by id so they can be renamed and synced. */
  folderId: string | null;
  tags: string[];
  pinned: boolean;
  /** Hidden on screen until revealed. This is not encryption. */
  locked: boolean;
  /** Set when moved to Trash; `null` while the note is live. */
  trashedAt: number | null;
  createdAt: number;
  updatedAt: number;
  body: Block[];
}

export const WORKSPACE_VERSION = 2;

/** Everything a user owns. This is the unit a repository loads, saves, exports and imports. */
export interface Workspace {
  version: typeof WORKSPACE_VERSION;
  notes: Note[];
  folders: Folder[];
}

export type NoteView =
  | { kind: 'all' }
  | { kind: 'pinned' }
  | { kind: 'locked' }
  | { kind: 'trash' }
  | { kind: 'folder'; folderId: string };

export type SortBy = 'updated' | 'created' | 'title';

export function emptyWorkspace(): Workspace {
  return { version: WORKSPACE_VERSION, notes: [], folders: [] };
}
