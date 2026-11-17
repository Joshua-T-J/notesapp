import { DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { ThemeValue } from '../models/note.model';

const STORAGE_KEY_THEME = 'nota_lively_theme_v4';

export interface ThemeOption {
  value: ThemeValue;
  displayName: string;
  iconClass: string;
  label: string;
}

export const THEMES: readonly ThemeOption[] = [
  {
    value: 'teal',
    displayName: 'Teal',
    iconClass: 'bi bi-droplet-half',
    label: 'Emerald Teal (Crisp Mint-Alabaster & Jewel Teal)',
  },
  {
    value: 'breeze',
    displayName: 'Breeze',
    iconClass: 'bi bi-stars',
    label: 'Periwinkle Breeze (Lively Soft Indigo-Blue)',
  },
  {
    value: 'aurora',
    displayName: 'Aurora',
    iconClass: 'bi bi-moon-stars',
    label: 'Midnight Aurora (Deep Slate & Luminous Teal)',
  },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly themes = THEMES;
  readonly theme = signal<ThemeValue>(this.readSavedTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  setTheme(theme: ThemeValue): void {
    this.theme.set(theme);
    this.applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    } catch {
      // Storage unavailable (private mode / quota) — the theme still applies for this session.
    }
  }

  private applyTheme(theme: ThemeValue): void {
    this.document.documentElement.setAttribute('data-theme', theme);
  }

  private readSavedTheme(): ThemeValue {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      return THEMES.some((t) => t.value === saved) ? (saved as ThemeValue) : 'teal';
    } catch {
      return 'teal';
    }
  }
}
