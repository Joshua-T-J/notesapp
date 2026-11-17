import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE } from './site';

export interface PageSeo {
  title: string;
  description: string;
  /** Path such as `/privacy`. */
  path: string;
  /** App screens are private: `noindex` and no structured data. */
  index: boolean;
  jsonLd?: Record<string, unknown>;
}

const JSON_LD_ID = 'nota-jsonld';

interface TrustedTypePolicyLike {
  createScript(input: string): unknown;
}
interface TrustedTypesLike {
  createPolicy(name: string, rules: { createScript: (s: string) => string }): TrustedTypePolicyLike;
}

/** Per-page <title>, description, canonical, robots, Open Graph/Twitter tags and JSON-LD. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private policy: TrustedTypePolicyLike | null | undefined;

  apply(page: PageSeo): void {
    const url = `${SITE.origin}${page.path}`;
    const image = `${SITE.origin}${SITE.ogImage}`;
    this.title.setTitle(page.title);

    const tags: [string, string, 'name' | 'property'][] = [
      ['description', page.description, 'name'],
      ['robots', page.index ? 'index, follow' : 'noindex, nofollow', 'name'],
      ['og:type', 'website', 'property'],
      ['og:site_name', SITE.name, 'property'],
      ['og:title', page.title, 'property'],
      ['og:description', page.description, 'property'],
      ['og:url', url, 'property'],
      ['og:image', image, 'property'],
      ['twitter:card', 'summary_large_image', 'name'],
      ['twitter:title', page.title, 'name'],
      ['twitter:description', page.description, 'name'],
      ['twitter:image', image, 'name'],
    ];
    for (const [key, content, attr] of tags) {
      this.meta.updateTag({ [attr]: key, content }, `${attr}="${key}"`);
    }

    this.setCanonical(url);
    this.setJsonLd(page.index ? page.jsonLd : undefined);
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data: Record<string, unknown> | undefined): void {
    const old = this.document.getElementById(JSON_LD_ID);
    old?.parentNode?.removeChild(old);
    if (!data) return;
    const script = this.document.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    // `<` is escaped so the JSON can never close the script element.
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    const policy = this.trustedTypesPolicy();
    (script as unknown as { textContent: unknown }).textContent = policy
      ? policy.createScript(json)
      : json;
    this.document.head.appendChild(script);
  }

  /** Named Trusted Types policy (`nota-jsonld`, allowed in the CSP) for JSON-LD only. */
  private trustedTypesPolicy(): TrustedTypePolicyLike | null {
    if (this.policy !== undefined) return this.policy;
    const tt = (globalThis as { trustedTypes?: TrustedTypesLike }).trustedTypes;
    try {
      this.policy = tt ? tt.createPolicy('nota-jsonld', { createScript: (s) => s }) : null;
    } catch {
      this.policy = null;
    }
    return this.policy;
  }
}
