import type { MetadataRoute } from "next";

function siteOrigin() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return [
    {
      url: `${origin}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${origin}/scan`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${origin}/pricing`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/waitlist`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
