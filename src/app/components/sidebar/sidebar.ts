import { Component, DOCUMENT, Inject, output, signal } from '@angular/core';

type ThemeValue = 'teal' | 'breeze' | 'aurora';

interface Theme {
  value: ThemeValue;
  displayName: string;
  iconClass: string;
  label: string;
}

@Component({
  imports: [],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
export class Sidebar {
  toggleSidebar = output<boolean>();

  private readonly themes: Theme[] = [
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

  private currentTheme = signal<ThemeValue>('teal');

  constructor(@Inject(DOCUMENT) private document: Document) {
    const saved = localStorage.getItem('theme') as ThemeValue | null;
    const theme = saved ?? 'teal';
    this.setTheme(theme);
  }

  setTheme(theme: ThemeValue): void {
    this.currentTheme.set(theme);
    this.document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
}
