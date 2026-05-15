"use client";

import Link from "next/link";
import { docsUrl, githubUrl } from "@/lib/marketing-content";

const LINKS = [
  { label: "Docs",      href: docsUrl,    external: true  },
  { label: "GitHub",    href: githubUrl,  external: true  },
  { label: "Pricing",   href: "/pricing", external: false },
  { label: "Dashboard", href: "/overview",external: false },
  { label: "Changelog", href: "https://github.com/kadireren7/Torqa/blob/main/CHANGELOG.md", external: true },
] as const;

export function LandingFooter() {
  return (
    <footer
      className="px-5 py-12 sm:px-10"
      style={{ borderTop: "1px solid var(--line)", background: "var(--surface-1)" }}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-6 sm:flex-row">
        <div>
          <p className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--fg-1)" }}>
            Torqa
          </p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--fg-4)" }}>
            Security copilot for MCP servers and AI agents.
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-7 gap-y-2" aria-label="Footer">
          {LINKS.map((l) =>
            l.external ? (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] transition-colors duration-150"
                style={{ color: "var(--fg-4)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-4)"; }}
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.label}
                href={l.href}
                className="text-[13px] transition-colors duration-150"
                style={{ color: "var(--fg-4)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-4)"; }}
              >
                {l.label}
              </Link>
            )
          )}
        </nav>

        <p className="text-[12px]" style={{ color: "var(--fg-4)" }}>
          © {new Date().getFullYear()} Torqa
        </p>
      </div>
    </footer>
  );
}
