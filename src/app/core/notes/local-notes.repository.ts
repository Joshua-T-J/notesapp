import { Injectable } from '@angular/core';
import { newId } from '../platform/ids';
import { LEGACY_KEYS, migrateLegacy } from './legacy-migration';
import { Workspace, emptyWorkspace } from './note.model';
import { LoadResult, NotesRepository } from './notes.repository';
import { createSeedWorkspace } from './seed';
import { parseWorkspace } from './workspace.schema';

export const WORKSPACE_KEY = 'nota.workspace.v2';
const RECOVERY_KEY = 'nota.workspace.v2.unreadable';

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Stores the whole workspace as one JSON document in this browser's localStorage. */
@Injectable()
export class LocalStorageNotesRepository extends NotesRepository {
  override async load(): Promise<LoadResult> {
    const now = Date.now();
    const stored = readJson(WORKSPACE_KEY);

    if (stored !== undefined) {
      const ws = parseWorkspace(stored);
      if (ws) return { workspace: ws, source: 'stored' };
      // Never overwrite data we could not read: keep a copy so it can be recovered by hand.
      localStorage.setItem(RECOVERY_KEY, localStorage.getItem(WORKSPACE_KEY) ?? '');
      return { workspace: emptyWorkspace(), source: 'recovered' };
    }

    const legacyNotes = readJson(LEGACY_KEYS.notes);
    if (legacyNotes !== undefined) {
      const ws = migrateLegacy(
        legacyNotes,
        readJson(LEGACY_KEYS.folders),
        readJson(LEGACY_KEYS.folderColors),
        newId,
        now,
      );
      const valid = parseWorkspace(ws);
      if (valid) {
        this.write(valid);
        this.removeLegacy();
        return { workspace: valid, source: 'migrated' };
      }
    }

    return { workspace: createSeedWorkspace(now, newId), source: 'new' };
  }

  override async save(workspace: Workspace): Promise<void> {
    this.write(workspace);
  }

  override async clear(): Promise<void> {
    localStorage.removeItem(WORKSPACE_KEY);
    localStorage.removeItem(RECOVERY_KEY);
    this.removeLegacy();
    // Keep an explicit empty workspace so the welcome notes are not re-created.
    this.write(emptyWorkspace());
  }

  override async usage(): Promise<number | null> {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    return raw === null ? 0 : new Blob([raw]).size;
  }

  /** Synchronous on purpose so `pagehide` flushes complete before the page goes away. */
  private write(workspace: Workspace): void {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  }

  private removeLegacy(): void {
    localStorage.removeItem(LEGACY_KEYS.notes);
    localStorage.removeItem(LEGACY_KEYS.folders);
    localStorage.removeItem(LEGACY_KEYS.folderColors);
  }
}
