import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { LanguageToggle, useI18n } from "../i18n";
import { useP120ScrollReveal } from "../hooks/useP120ScrollReveal";
import { useTheme } from "../hooks/useTheme";

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const id = hash.slice(1);
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (attempts < 12) {
        attempts += 1;
        requestAnimationFrame(tryScroll);
      }
    };
    requestAnimationFrame(tryScroll);
  }, [pathname, hash]);
  return null;
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "p134-nav-link p134-nav-link--active" : "p134-nav-link";
}

export function SiteLayout() {
  const { theme, toggle } = useTheme();
  const { t, locale } = useI18n();
  const { pathname } = useLocation();
  useP120ScrollReveal(locale, pathname);

  return (
    <>
      <ScrollToTop />
      <div className="p70-bg-grid" aria-hidden="true" />
      <header className="p70-header">
        <div className="p70-header-inner">
          <Link className="p70-logo" to="/">
            <span className="p70-logo-mark">TQ</span>
            <span className="p70-logo-text">TORQA</span>
          </Link>
          <nav className="p70-nav p134-header-nav" aria-label={t("nav.primary")}>
            <NavLink to="/" end className={navLinkClass}>
              {t("nav.home")}
            </NavLink>
            <NavLink to="/product" className={navLinkClass}>
              {t("nav.product")}
            </NavLink>
            <NavLink to="/proof" className={navLinkClass}>
              {t("nav.proof")}
            </NavLink>
            <NavLink to="/try" className={navLinkClass}>
              {t("nav.try")}
            </NavLink>
            <NavLink to="/docs" className={navLinkClass}>
              {t("nav.docs")}
            </NavLink>
            <NavLink to="/pricing" className={navLinkClass}>
              {t("nav.pricing")}
            </NavLink>
            <NavLink to="/contact" className={navLinkClass}>
              {t("nav.contact")}
            </NavLink>
          </nav>
          <div className="p70-header-cta">
            <LanguageToggle className="i18n-lang-toggle i18n-lang-toggle--header" />
            <button type="button" className="p70-btn p70-btn-ghost" onClick={toggle} aria-label={t("theme.toggle")}>
              {theme === "dark" ? t("theme.light") : t("theme.dark")}
            </button>
            <Link className="p70-btn p70-btn-primary" to={{ pathname: "/", hash: "#desktop" }}>
              {t("nav.getApp")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="p70-footer">
        <div className="p70-wrap p70-footer-inner">
          <nav className="p134-footer-nav" aria-label={t("footer.nav")}>
            <Link to="/">{t("nav.home")}</Link>
            <Link to="/product">{t("nav.product")}</Link>
            <Link to="/proof">{t("nav.proof")}</Link>
            <Link to="/try">{t("nav.try")}</Link>
            <Link to="/docs">{t("nav.docs")}</Link>
            <Link to="/pricing">{t("nav.pricing")}</Link>
            <Link to="/contact">{t("nav.contact")}</Link>
            <a href="/desktop">{t("desktop.pointer")}</a>
            <Link to={{ pathname: "/", hash: "#desktop" }}>{t("nav.desktop")}</Link>
          </nav>
          <p className="p70-footer-brand">{t("footer.brand")}</p>
          <p className="p70-footer-copy">{t("footer.copy")}</p>
        </div>
      </footer>
    </>
  );
}
