import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="wrap">
        <span>© {{ year }} Nota</span>
        <span class="spacer"></span>
        <a routerLink="/privacy">Privacy policy</a>
        <a routerLink="/app">Open the app</a>
      </div>
    </footer>
  `,
  styles: `
    .footer {
      border-top: 1px solid var(--border);
    }
    .wrap {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 20px;
      max-width: 1120px;
      margin: 0 auto;
      padding: 28px 24px;
      color: var(--ink-3);
      font-size: 14px;
    }
    .spacer {
      flex: 1;
    }
    a {
      color: var(--ink-2);
    }
  `,
})
export class SiteFooter {
  /** Fixed at build time: the page is prerendered. */
  protected readonly year = 2026;
}
