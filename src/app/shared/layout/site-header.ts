import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink],
  template: `
    <header class="header">
      <div class="wrap">
        <a routerLink="/" class="wordmark">Nota</a>
        <nav aria-label="Main">
          <a routerLink="/privacy" class="link">Privacy</a>
          <a routerLink="/app" class="btn btn-primary">Open Nota</a>
        </nav>
      </div>
    </header>
  `,
  styles: `
    .header {
      border-bottom: 1px solid var(--border);
    }
    .wrap {
      display: flex;
      align-items: center;
      gap: 24px;
      max-width: 1120px;
      height: 64px;
      margin: 0 auto;
      padding: 0 24px;
    }
    .wordmark {
      flex: 1;
      font-family: var(--font-title);
      font-size: 21px;
      font-weight: 600;
      letter-spacing: -0.02em;
      text-decoration: none;
    }
    nav {
      display: flex;
      align-items: center;
      gap: 20px;
      font-size: 15px;
    }
    .link {
      color: var(--ink-2);
      text-decoration: none;
    }
    .link:hover {
      color: var(--ink);
    }
  `,
})
export class SiteHeader {}
