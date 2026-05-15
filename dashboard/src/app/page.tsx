import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/marketing/landing-navbar";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingPillars } from "@/components/marketing/landing-pillars";
import { LandingFlow } from "@/components/marketing/landing-flow";
import { LandingMetricsBand } from "@/components/marketing/landing-metrics-band";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { docsUrl, githubUrl } from "@/lib/marketing-content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Torqa | Security copilot for MCP servers and AI agents",
  description:
    "Torqa scans MCP server configs and AI agent definitions. Detects risky permissions, exposed secrets, and unsafe capabilities — then guides you through the fix.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Torqa | Security copilot for MCP servers and AI agents",
    description: "Scan MCP tool manifests and AI agent configs. Get deterministic findings and fix guidance.",
    url: "/",
    type: "website",
  },
};

export default async function MarketingLandingPage() {
  const supabase = await createClient();
  let navUser: { email: string; displayName: string | null } | null = null;
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const meta = user.user_metadata as Record<string, unknown> | undefined;
      navUser = {
        email: user.email,
        displayName:
          (typeof meta?.full_name === "string" && meta.full_name) ||
          (typeof meta?.name === "string" && meta.name) ||
          null,
      };
    }
  }

  return (
    <div className="bg-background text-foreground">
      <LandingNavbar user={navUser} />

      <main id="main-content">
        <MarketingHero />
        <LandingPillars />
        <LandingFlow />
        <LandingMetricsBand />

        {/* Final CTA */}
        <section className="border-t border-border px-5 py-28 text-center sm:px-10 sm:py-40" style={{ background: "var(--surface-1)" }}>
          <div className="mx-auto max-w-[700px]">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
              Public alpha
            </p>
            <h2 className="mb-5 text-[40px] font-bold leading-[1.06] tracking-[-0.04em] sm:text-[56px]" style={{ color: "var(--fg-1)" }}>
              Start with a scan.
              <br />
              Ship with confidence.
            </h2>
            <p className="mb-10 text-[16px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>
              Connect an MCP server or try the unsafe MCP demo to see findings immediately.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/sources"
                className="rounded-lg px-7 py-3.5 text-[14px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Connect MCP server
              </Link>
              <Link
                href="/scan?sample=unsafe_mcp&source=mcp"
                className="rounded-lg border px-7 py-3.5 text-[14px] font-medium transition-colors hover:opacity-80"
                style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
              >
                Try unsafe MCP demo
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-4 text-[13px]" style={{ color: "var(--fg-4)" }}>
              <a href={docsUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">
                Read docs
              </a>
              <span aria-hidden>·</span>
              <a href={githubUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">
                GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
