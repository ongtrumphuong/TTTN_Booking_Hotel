import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSitemapData } from "@/lib/hotels";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // đọc APP_URL lúc chạy chứ không cố định theo lúc build
  const base = siteUrl();
  const { hotels, cities } = await getSitemapData();

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/hotels`, changeFrequency: "daily", priority: 0.9 },
    ...cities.map((c) => ({ url: `${base}/hotels?city=${encodeURIComponent(c)}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...hotels.map((h) => ({ url: `${base}/hotels/${h.slug}`, lastModified: h.createdAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
