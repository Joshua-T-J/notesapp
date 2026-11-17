import { Component, DestroyRef, DOCUMENT, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';
import { SITE } from '../../core/seo/site';
import { SiteFooter } from '../../shared/layout/site-footer';
import { SiteHeader } from '../../shared/layout/site-header';

/** How far below the top of the viewport a heading counts as "current" (px). */
const SPY_OFFSET = 120;

@Component({
  selector: 'app-privacy',
  imports: [RouterLink, SiteHeader, SiteFooter],
  templateUrl: './privacy.html',
  styleUrl: './privacy.scss',
})
export class Privacy {
  protected readonly site = SITE;
  protected readonly sections = [
    { id: 'summary', label: 'Summary' },
    { id: 'stored', label: 'What is stored' },
    { id: 'not-collected', label: 'What is not collected' },
    { id: 'hosting', label: 'Hosting' },
    { id: 'locked', label: 'Locked notes' },
    { id: 'your-data', label: 'Exporting and deleting' },
    { id: 'sync', label: 'Future sync' },
    { id: 'changes', label: 'Changes and contact' },
  ];
  /** Section currently in view, for the table of contents (scroll spy). */
  protected readonly active = signal('summary');
  /** After a click in the contents, the clicked section stays highlighted while the page jumps. */
  private holdUntil = 0;

  protected select(id: string): void {
    this.active.set(id);
    this.holdUntil = performance.now() + 600;
  }

  constructor() {
    inject(SeoService).apply({
      title: 'Privacy policy — Nota',
      description:
        'How Nota handles your data: notes stay in your browser, with no accounts, cookies, analytics or advertising.',
      path: '/privacy',
      index: true,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Privacy policy',
        url: `${SITE.origin}/privacy`,
        isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.origin },
      },
    });

    // Browser only: track which section is at the top of the viewport.
    const document = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      let frame = 0;
      const update = () => {
        frame = 0;
        if (performance.now() < this.holdUntil) return;
        const atBottom =
          window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        let current = this.sections[0]?.id ?? '';
        for (const { id } of this.sections) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top <= SPY_OFFSET) current = id;
        }
        if (atBottom) current = this.sections.at(-1)?.id ?? current;
        this.active.set(current);
      };
      const onScroll = () => (frame ||= requestAnimationFrame(update));
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      update();
      destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        cancelAnimationFrame(frame);
      });
    });
  }
}
