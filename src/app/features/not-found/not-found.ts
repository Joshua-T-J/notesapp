import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <main id="main" class="wrap" tabindex="-1">
      <p class="code">404</p>
      <h1>This page doesn’t exist</h1>
      <p>The link may be old or mistyped.</p>
      <div class="links">
        <a routerLink="/" class="btn btn-secondary">Home</a>
        <a routerLink="/app" class="btn btn-primary">Open Nota</a>
      </div>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: var(--bg);
    }
    .wrap {
      max-width: 560px;
      margin: 0 auto;
      padding: 18vh 24px 48px;
      outline: none;
    }
    .code {
      margin: 0;
      color: var(--ink-3);
      font-weight: 600;
    }
    h1 {
      margin: 6px 0 8px;
      font-size: 32px;
      font-weight: 600;
    }
    p {
      color: var(--ink-2);
    }
    .links {
      display: flex;
      gap: 10px;
      margin-top: 24px;
    }
  `,
})
export class NotFound {
  constructor() {
    inject(SeoService).apply({
      title: 'Page not found — Nota',
      description: 'This page does not exist.',
      path: '/404',
      index: false,
    });
  }
}
