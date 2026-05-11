"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";

export type LandingNavbarUser = {
  email: string;
  displayName: string | null;
} | null;

const NAV_LINKS = [
  { label: "Platform",     href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Metrics",      href: "#metrics" },
];

type Props = { user: LandingNavbarUser };

export function LandingNavbar({ user }: Props) {
  const router = useRouter();
  const [scrolled, setScrolled]     = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const onScroll = useCallback(() => setScrolled(window.scrollY > 24), []);
  useEffect(() => {
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  // Close mobile menu on route change / resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function signOut() {
    const supabase = getBrowserSupabase();
    await supabase?.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <nav
        className={cn(
          "fixed inset-x-0 top-0 z-50 flex items-center px-6 py-4 sm:px-10",
          "transition-all duration-300",
        )}
        style={{
          background: scrolled || mobileOpen ? "var(--header-bg)" : "transparent",
          backdropFilter: scrolled || mobileOpen ? "blur(20px)" : "none",
          WebkitBackdropFilter: scrolled || mobileOpen ? "blur(20px)" : "none",
          borderBottom: scrolled || mobileOpen ? "1px solid var(--line)" : "1px solid transparent",
        }}
      >
        {/* Logo — flex-1 keeps it left while center stays truly centered */}
        <div className="flex flex-1">
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
        </div>

        {/* Center links — truly centered because both sides are flex-1 */}
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

        {/* Actions — flex-1 + justify-end mirrors the logo side */}
        <div className="flex flex-1 items-center justify-end gap-1.5">
          <ThemeToggle />

          {/* Desktop CTA buttons */}
          <div className="hidden md:flex md:items-center md:gap-1.5">
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

          {/* Mobile hamburger */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:hidden"
            style={{ color: "var(--fg-2)" }}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-x-0 top-[65px] z-40 md:hidden",
          "transition-all duration-300 ease-in-out",
          mobileOpen ? "pointer-events-auto opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2",
        )}
        style={{
          background: "var(--header-bg)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="flex flex-col px-6 py-4 gap-1">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-lg px-3 py-2.5 text-[14px] transition-colors duration-150"
              style={{ color: "var(--fg-2)" }}
              onClick={() => setMobileOpen(false)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--overlay-sm)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {l.label}
            </a>
          ))}

          <div className="my-2" style={{ borderTop: "1px solid var(--line)" }} />

          {user ? (
            <>
              <Link
                href="/overview"
                className="rounded-lg px-3 py-2.5 text-[14px] font-semibold text-center transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "#fff" }}
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </Link>
              <button
                onClick={() => { setMobileOpen(false); void signOut(); }}
                className="rounded-lg px-3 py-2.5 text-[14px] text-center transition-colors"
                style={{ color: "var(--fg-3)" }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2.5 text-[14px] font-semibold text-center transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "#fff" }}
                onClick={() => setMobileOpen(false)}
              >
                Get started free
              </Link>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2.5 text-[14px] text-center transition-colors"
                style={{ color: "var(--fg-3)" }}
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
    </>
  );
}
