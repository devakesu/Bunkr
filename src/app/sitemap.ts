import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) return [];
  // Use BUILD_TIMESTAMP for stable, deterministic lastModified across requests.
  // Omit lastModified when not set (e.g. local dev) to avoid non-deterministic dates.
  const lastModified = process.env.BUILD_TIMESTAMP
    ? new Date(process.env.BUILD_TIMESTAMP)
    : undefined;
  return [
    { url: baseUrl, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${baseUrl}/contact`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/help`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/legal`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ];
}