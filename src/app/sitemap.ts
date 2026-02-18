import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: process.env.NEXT_PUBLIC_APP_URL || ''   , lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: process.env.NEXT_PUBLIC_APP_URL + '/login', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: process.env.NEXT_PUBLIC_APP_URL + '/contact', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: process.env.NEXT_PUBLIC_APP_URL + '/legal', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: process.env.NEXT_PUBLIC_APP_URL + '/build-info', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];
}