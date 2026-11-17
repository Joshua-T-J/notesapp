import { Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';
import { SITE } from '../../core/seo/site';
import { SiteFooter } from '../../shared/layout/site-footer';
import { SiteHeader } from '../../shared/layout/site-header';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, NgOptimizedImage, SiteHeader, SiteFooter],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  constructor() {
    inject(SeoService).apply({
      title: 'Nota — a private notebook that stays on your device',
      description: SITE.description,
      path: '/',
      index: true,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: SITE.name,
        url: SITE.origin,
        description: SITE.description,
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Any (web browser)',
        browserRequirements: 'Requires JavaScript and localStorage',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
    });
  }
}
