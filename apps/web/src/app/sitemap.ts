import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.superselleria.com.br';
  const pages = [
    '',
    'overview',
    'recommendations',
    'ai',
    'legal/privacy',
    'legal/terms',
  ];

  const now = new Date().toISOString();

  return pages.map((path) => ({
    url: `${baseUrl}/${path}`,
    lastModified: now,
    changeFrequency: path.startsWith('legal') ? 'weekly' : 'weekly',
    priority: path.startsWith('legal') ? 0.3 : 0.8,
  })) as MetadataRoute.Sitemap;
}
