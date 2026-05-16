import type { MetadataRoute } from "next";

function siteOrigin() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return [
    { url: `${origin}/`,           changeFrequency: "weekly",  priority: 1 },
    { url: `${origin}/builder`,    changeFrequency: "weekly",  priority: 0.9 },
    { url: `${origin}/mcp-server`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
