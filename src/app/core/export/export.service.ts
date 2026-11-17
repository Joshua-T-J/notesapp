import { DOCUMENT, inject, Injectable } from '@angular/core';
import { AssetStore } from '../assets/asset-store';
import { extensionFor } from '../assets/image-processing';
import { ImageRef, imageIds, toMarkdown, toPlainText } from '../content/blocks';
import { Note, Workspace } from '../notes/note.model';
import { NotesStore } from '../notes/notes.store';
import { BackupAsset, parseBackupAssets, parseWorkspace } from '../notes/workspace.schema';
import { createZip, ZipEntry } from './zip';

const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

/** File-system-safe name, kept readable. */
export function fileNameFor(title: string, fallback = 'Untitled'): string {
  const clean = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return clean || fallback;
}

export interface Backup {
  workspace: Workspace;
  assets: BackupAsset[];
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Downloads (single note, all notes, backups) and backup import. */
@Injectable()
export class ExportService {
  private readonly document = inject(DOCUMENT);
  private readonly store = inject(NotesStore);
  private readonly assets = inject(AssetStore);

  /** Markdown with images referenced as `images/<id>.<ext>` (see the zip exports). */
  noteAsMarkdown(note: Note, types: ReadonlyMap<string, string> = new Map()): string {
    return toMarkdown(note.title, note.body, { imagePath: (img) => this.imagePath(img, types) });
  }

  private imagePath(img: ImageRef, types: ReadonlyMap<string, string>): string {
    return `images/${img.assetId}.${extensionFor(types.get(img.assetId) ?? 'image/webp')}`;
  }

  /** Image files for the given notes, plus a map of their types for the Markdown paths. */
  private async imageEntries(
    notes: readonly Note[],
  ): Promise<{ entries: ZipEntry[]; types: Map<string, string> }> {
    const types = new Map<string, string>();
    const entries: ZipEntry[] = [];
    for (const id of new Set(notes.flatMap((n) => imageIds(n.body)))) {
      const asset = await this.assets.get(id);
      if (!asset) continue;
      types.set(id, asset.type);
      entries.push({
        path: `images/${id}.${extensionFor(asset.type)}`,
        content: new Uint8Array(await asset.blob.arrayBuffer()),
      });
    }
    return { entries, types };
  }

  /** A note with images downloads as a .zip (Markdown + images); otherwise a single file. */
  async downloadNote(note: Note, format: 'md' | 'txt'): Promise<void> {
    const name = fileNameFor(note.title);
    if (format === 'txt') {
      const text = `${note.title ? `${note.title}\n\n` : ''}${toPlainText(note.body)}\n`;
      this.download(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${name}.txt`);
      return;
    }
    if (!imageIds(note.body).length) {
      this.download(
        new Blob([this.noteAsMarkdown(note)], { type: 'text/markdown;charset=utf-8' }),
        `${name}.md`,
      );
      return;
    }
    const { entries, types } = await this.imageEntries([note]);
    const zip = createZip([
      { path: `${name}.md`, content: this.noteAsMarkdown(note, types) },
      ...entries,
    ]);
    this.download(
      new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' }),
      `${name}.zip`,
    );
  }

  /** Every live note as Markdown, one folder per Nota folder, images in images/. */
  async downloadAllAsZip(): Promise<number> {
    const folders = this.store.folderById();
    const notes = this.store.liveNotes();
    const { entries: images, types } = await this.imageEntries(notes);
    const used = new Set<string>();
    const entries: ZipEntry[] = notes.map((note) => {
      const dir = note.folderId
        ? `${fileNameFor(folders.get(note.folderId)?.name ?? '', 'Folder')}/`
        : '';
      let base = `${dir}${fileNameFor(note.title)}`;
      for (let i = 2; used.has(base.toLowerCase()); i++)
        base = `${dir}${fileNameFor(note.title)} ${i}`;
      used.add(base.toLowerCase());
      // Notes inside a folder reach the shared images/ folder one level up.
      const md = this.noteAsMarkdown(note, types).replace(
        /\]\(images\//g,
        dir ? '](../images/' : '](images/',
      );
      return { path: `${base}.md`, content: md, modified: new Date(note.updatedAt) };
    });
    const zip = createZip([...entries, ...images]);
    this.download(
      new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' }),
      `nota-notes-${this.stamp()}.zip`,
    );
    return entries.length;
  }

  /** Everything, including images, in one .json file. */
  async downloadBackup(): Promise<void> {
    const snapshot = this.store.snapshot();
    const wanted = new Set(snapshot.notes.flatMap((n) => imageIds(n.body)));
    const assets: BackupAsset[] = [];
    for (const asset of await this.assets.all()) {
      if (!wanted.has(asset.id)) continue;
      assets.push({
        id: asset.id,
        type: asset.type as BackupAsset['type'],
        data: toBase64(new Uint8Array(await asset.blob.arrayBuffer())),
      });
    }
    const json = JSON.stringify({ ...snapshot, assets });
    this.download(
      new Blob([json], { type: 'application/json' }),
      `nota-backup-${this.stamp()}.json`,
    );
  }

  /** Reads and validates a backup file. Returns `null` for anything that isn't a Nota backup. */
  async readBackup(file: File): Promise<Backup | null> {
    if (file.size > MAX_IMPORT_BYTES) return null;
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const workspace = parseWorkspace(raw);
      if (!workspace) return null;
      const assets = parseBackupAssets((raw as { assets?: unknown }).assets ?? []);
      return { workspace, assets };
    } catch {
      return null;
    }
  }

  /** Stores a backup's images (keeping their ids) so imported notes can show them. */
  async importAssets(assets: readonly BackupAsset[]): Promise<void> {
    const existing = new Set(await this.assets.ids());
    for (const a of assets) {
      if (existing.has(a.id)) continue;
      await this.assets.put(new Blob([fromBase64(a.data)], { type: a.type }), a.id);
    }
  }

  private stamp(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = this.document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    this.document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
