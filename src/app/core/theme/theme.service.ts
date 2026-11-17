import { DOCUMENT, DestroyRef, PLATFORM_ID, inject, Injectable, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { readItem, writeItem } from '../platform/storage';

export type ThemePreference = 'system' | 'light' | 'dark';
export const THEME_KEY = 'nota.theme';

/**
 * System / Light / Dark. The choice is applied as `data-theme` on <html>; an inline script in
 * index.html applies it before first paint so there is no flash.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly media = this.isBrowser ? matchMedia('(prefers-color-scheme: dark)') : null;

  readonly preference = signal<ThemePreference>(this.readPreference());
  readonly resolved = signal<'light' | 'dark'>('light');

  constructor() {
    this.apply();
    const onChange = () => this.preference() === 'system' && this.apply();
    this.media?.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('change', onChange));
  }

  setPreference(value: ThemePreference): void {
    this.preference.set(value);
    writeItem(THEME_KEY, value);
    this.apply();
  }

  private apply(): void {
    const pref = this.preference();
    const dark = pref === 'dark' || (pref === 'system' && !!this.media?.matches);
    this.resolved.set(dark ? 'dark' : 'light');
    this.document.documentElement.setAttribute('data-theme', this.resolved());
  }

  private readPreference(): ThemePreference {
    const saved = readItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  }
}
