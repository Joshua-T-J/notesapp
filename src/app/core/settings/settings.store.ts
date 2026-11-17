import { Injectable, signal } from '@angular/core';
import { readItem, writeItem } from '../platform/storage';

const KEY = 'nota.settings.v1';

export interface Settings {
  /** Show titles only in the note list. */
  hidePreviews: boolean;
  /** Hide a locked note's text again when you leave it. */
  relockOnLeave: boolean;
  /** Library sidebar shown as an icon rail. */
  sidebarCollapsed: boolean;
}

const DEFAULTS: Settings = { hidePreviews: false, relockOnLeave: true, sidebarCollapsed: false };

const bool = (obj: Record<string, unknown>, key: keyof Settings): boolean =>
  typeof obj[key] === 'boolean' ? (obj[key] as boolean) : DEFAULTS[key];

function read(): Settings {
  try {
    const parsed: unknown = JSON.parse(readItem(KEY) ?? '{}');
    const obj =
      typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    return {
      hidePreviews: bool(obj, 'hidePreviews'),
      relockOnLeave: bool(obj, 'relockOnLeave'),
      sidebarCollapsed: bool(obj, 'sidebarCollapsed'),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Per-device preferences. Kept apart from notes: they should not sync between devices. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly state = signal<Settings>(read());
  readonly settings = this.state.asReadonly();

  update(patch: Partial<Settings>): void {
    this.state.update((s) => ({ ...s, ...patch }));
    writeItem(KEY, JSON.stringify(this.state()));
  }
}
