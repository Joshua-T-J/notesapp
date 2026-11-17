import { Injectable } from '@angular/core';
import { newId } from '../platform/ids';

const DB_NAME = 'nota-assets';
const STORE = 'assets';

export interface StoredAsset {
  id: string;
  type: string;
  blob: Blob;
  createdAt: number;
}

/**
 * Images live in IndexedDB, not localStorage: localStorage holds about 5 MB of text, while
 * IndexedDB stores binary data with a much larger quota. Notes only keep the asset id.
 * A sync backend would upload these by id; the editor and notes do not change.
 */
@Injectable()
export class AssetStore {
  private db: Promise<IDBDatabase> | null = null;
  private readonly urls = new Map<string, string>();

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  }

  private async tx<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(blob: Blob, id: string = newId()): Promise<string> {
    const asset: StoredAsset = { id, type: blob.type, blob, createdAt: Date.now() };
    await this.tx('readwrite', (s) => s.put(asset));
    return id;
  }

  async get(id: string): Promise<StoredAsset | null> {
    return (await this.tx<StoredAsset | undefined>('readonly', (s) => s.get(id))) ?? null;
  }

  /** Object URL for showing an image; cached so re-rendering the editor does not flicker. */
  async url(id: string): Promise<string | null> {
    const cached = this.urls.get(id);
    if (cached) return cached;
    const asset = await this.get(id).catch(() => null);
    if (!asset) return null;
    const url = URL.createObjectURL(asset.blob);
    this.urls.set(id, url);
    return url;
  }

  async all(): Promise<StoredAsset[]> {
    return this.tx<StoredAsset[]>('readonly', (s) => s.getAll());
  }

  async ids(): Promise<string[]> {
    return (await this.tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())).map(String);
  }

  async delete(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      await this.tx('readwrite', (s) => s.delete(id));
      const url = this.urls.get(id);
      if (url) URL.revokeObjectURL(url);
      this.urls.delete(id);
    }
  }

  /** Removes images no note refers to any more (including notes in Trash). */
  async collectGarbage(referenced: ReadonlySet<string>): Promise<number> {
    const unused = (await this.ids()).filter((id) => !referenced.has(id));
    await this.delete(unused);
    return unused.length;
  }

  async clear(): Promise<void> {
    await this.tx('readwrite', (s) => s.clear());
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
  }

  async usage(): Promise<number> {
    return (await this.all()).reduce((sum, a) => sum + a.blob.size, 0);
  }
}
