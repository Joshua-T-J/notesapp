import { Component, DestroyRef, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { ConfirmDialog } from './shared/ui/confirm-dialog';
import { Toaster } from './shared/ui/toaster';

/** First path segment, e.g. "" | "privacy" | "app". Focus moves to <main> only when it changes. */
function section(url: string): string {
  const path = url.split(/[?#]/)[0] ?? '';
  const [first = '', second = ''] = path.split('/').filter(Boolean);
  return first === 'app' && second === 'settings' ? 'app/settings' : first;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialog, Toaster],
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <router-outlet />
    <app-confirm-dialog />
    <app-toaster />
  `,
})
export class App {
  constructor() {
    // Created eagerly so the theme is applied (and followed) on every page.
    inject(ThemeService);

    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    // Remember whether the user is on the keyboard or a pointer, for focus rings on borderless
    // text fields (see .keyboard-focus-ring).
    const root = document.documentElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') root.dataset['modality'] = 'keyboard';
    };
    const onPointer = () => (root.dataset['modality'] = 'pointer');
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);

    const router = inject(Router);
    let current: string | null = null;
    const sub = router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      const next = section(event.urlAfterRedirects);
      if (current !== null && next !== current) {
        // New page: move focus to its main region so screen readers start at the content.
        setTimeout(() => document.getElementById('main')?.focus({ preventScroll: true }));
      }
      current = next;
    });
    inject(DestroyRef).onDestroy(() => {
      sub.unsubscribe();
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
    });
  }
}
