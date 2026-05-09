import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/marketing/landing-navbar";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingPillars } from "@/components/marketing/landing-pillars";
import { LandingFlow } from "@/components/marketing/landing-flow";
import { LandingMetricsBand } from "@/components/marketing/landing-metrics-band";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "The governance layer for every automation",
  description:
    "Torqa scans, fixes, and governs workflows across n8n, GitHub, agents, and webhooks. Deterministic decisions. One gate.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Torqa — Scan. Fix. Govern.",
    description: "Scan every workflow, fix every finding, enforce every policy. One gate.",
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
              Get started
            </p>
            <h2 className="mb-5 text-[40px] font-bold leading-[1.06] tracking-[-0.04em] sm:text-[56px]" style={{ color: "var(--fg-1)" }}>
              Governance for your
              <br />
              automation stack.
            </h2>
            <p className="mb-10 text-[16px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>
              Private beta is open. Connect your first source in two minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/login"
                className="rounded-lg px-7 py-3.5 text-[14px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Start for free
              </Link>
              <Link
                href="/demo/report"
                className="rounded-lg border px-7 py-3.5 text-[14px] font-medium transition-colors hover:opacity-80"
                style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
              >
                View live demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
