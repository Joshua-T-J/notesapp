import { FolderColorKey, FolderTone } from '../models/note.model';

export interface FolderColorOption extends FolderTone {
  key: FolderColorKey;
  label: string;
}

/** The palette folders can use. Order matters: "Auto" cycles through it by folder position. */
export const FOLDER_TONES: readonly FolderColorOption[] = [
  { key: 'teal', label: 'Teal', cls: 'folder-tone-teal', hex: '#0D9488' },
  { key: 'indigo', label: 'Indigo', cls: 'folder-tone-indigo', hex: '#6366F1' },
  { key: 'amber', label: 'Amber', cls: 'folder-tone-amber', hex: '#F59E0B' },
  { key: 'rose', label: 'Rose', cls: 'folder-tone-rose', hex: '#E11D48' },
  { key: 'sky', label: 'Sky', cls: 'folder-tone-sky', hex: '#0EA5E9' },
];

export const UNFILED_TONE: FolderTone = { cls: 'unfiled', hex: 'var(--accent)' };
