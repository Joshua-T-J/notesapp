/**
 * Public site details used for canonical URLs, Open Graph and the sitemap.
 * TODO(deploy): set ORIGIN to the production URL (also update public/sitemap.xml and robots.txt).
 */
export const SITE = {
  name: 'Nota',
  origin: 'https://nota-notes.vercel.app',
  description:
    'Nota is a plain, private notebook. No account, no tracking. Your notes stay in your browser and export to Markdown.',
  ogImage: '/og-image.png',
  /** TODO(deploy): a real address for privacy questions. */
  contactEmail: 'privacy@example.com',
  privacyEffective: '17 November 2026',
  host: 'Vercel',
  hostPrivacyUrl: 'https://vercel.com/legal/privacy-policy',
} as const;
