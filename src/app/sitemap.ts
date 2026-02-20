import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const url = (path: string) => baseUrl ? `${baseUrl}${path}` : '';
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: url('/login'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: url('/contact'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: url('/help'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: url('/legal'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: url('/build-info'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];
}