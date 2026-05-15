import type { Metadata } from "next";
import Link from "next/link";
import { LandingNavbar } from "@/components/marketing/landing-navbar";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { WaitlistForm } from "./waitlist-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Early Access | Torqa",
  description:
    "Join the Torqa early access list. Be among the first to use cloud-backed MCP server security scanning, team workspaces, and continuous governance.",
  openGraph: {
    title: "Get early access to Torqa",
    description:
      "Torqa helps developers scan MCP servers, fix unsafe tools, and export hardened configs before AI agents use them.",
    url: "/waitlist",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Get early access to Torqa",
    description:
      "Scan MCP servers, detect unsafe tools and secrets, fix critical issues, and export hardened configs.",
  },
  robots: { index: true, follow: true },
};

export default async function WaitlistPage() {
  const supabase = await createClient();
  let navUser: { email: string; displayName: string | null } | null = null;
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
        <section
          className="flex min-h-screen items-center justify-center px-5 pb-20 pt-28 sm:px-10"
          style={{ background: "var(--surface-0)" }}
        >
          {/* Grid bg */}
          <div
            className="pointer-events-none fixed inset-0 -z-10"
            style={{
              backgroundImage:
                "linear-gradient(var(--line) 1px, transparent 1px)," +
                "linear-gradient(90deg, var(--line) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
            aria-hidden
          />

          <div className="w-full max-w-[480px]">
            {/* Header */}
            <div className="mb-8 space-y-3">
              <p
                className="font-mono text-[11px] uppercase tracking-[0.12em]"
                style={{ color: "var(--fg-4)" }}
              >
                Early access
              </p>
              <h1
                className="text-[36px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[44px]"
                style={{ color: "var(--fg-1)" }}
              >
                Get early access to Torqa
              </h1>
              <p
                className="text-[15px] leading-[1.65]"
                style={{ color: "var(--fg-3)" }}
              >
                Torqa helps developers scan MCP servers, fix unsafe tools, and
                export hardened configs before AI agents use them.
              </p>

              {/* Trust note */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  "Deterministic engine",
                  "No external AI calls",
                  "Local-first demo",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      background: "var(--overlay-sm)",
                      border: "1px solid var(--line)",
                      color: "var(--fg-3)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Form card */}
            <div
              className="rounded-2xl p-6 sm:p-8"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--line-2)",
              }}
            >
              <WaitlistForm />
            </div>

            {/* No account needed */}
            <p
              className="mt-6 text-center text-[13px]"
              style={{ color: "var(--fg-4)" }}
            >
              No account needed for the free scanner.{" "}
              <Link
                href="/scan"
                className="underline hover:opacity-80"
                style={{ color: "var(--fg-3)" }}
              >
                Try it now
              </Link>
            </p>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
