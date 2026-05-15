import type { MetadataRoute } from "next";

function siteOrigin() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/scan", "/pricing", "/waitlist"],
        disallow: ["/report/", "/api/", "/(app)/", "/share/"],
      },
    ],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
