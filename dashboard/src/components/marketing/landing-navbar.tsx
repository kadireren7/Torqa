"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";

export type LandingNavbarUser = {
  email: string;
  displayName: string | null;
} | null;

const NAV_LINKS = [
  { label: "Platform",    href: "#features" },
  { label: "How it works",href: "#how" },
  { label: "Metrics",     href: "#metrics" },
];

type Props = { user: LandingNavbarUser };

export function LandingNavbar({ user }: Props) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  const onScroll = useCallback(() => setScrolled(window.scrollY > 24), []);
  useEffect(() => {
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  async function signOut() {
    const supabase = getBrowserSupabase();
    await supabase?.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      className={cn(
        "fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 sm:px-10",
        "transition-all duration-300",
      )}
      style={{
        background: scrolled ? "var(--header-bg)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid var(--line)" : "1px solid transparent",
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em]"
        style={{ color: "var(--fg-1)" }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }} aria-hidden>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </span>
        Torqa
      </Link>

      {/* Center links */}
      <div className="hidden items-center gap-8 md:flex">
        {NAV_LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            className="text-[13px] transition-colors duration-150"
            style={{ color: "var(--fg-3)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-3)"; }}
          >
            {l.label}
          </a>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        {user ? (
          <>
            <Link
              href="/overview"
              className="rounded-lg px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Dashboard
            </Link>
            <button
              onClick={() => void signOut()}
              className="rounded-lg px-4 py-2 text-[13px] transition-colors duration-150"
              style={{ color: "var(--fg-3)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-3)"; }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-[13px] transition-colors duration-150"
              style={{ color: "var(--fg-3)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--fg-3)"; }}
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
