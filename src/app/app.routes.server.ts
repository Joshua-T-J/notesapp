import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Public pages are prerendered at build time (SEO, fast first paint). The app itself uses
 * localStorage, so it renders only in the browser and is served from index.csr.html.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
