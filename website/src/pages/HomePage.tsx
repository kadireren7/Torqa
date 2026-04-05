import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { BenchmarkLive } from "../widgets/BenchmarkLive";

export function HomePage() {
  const { t } = useI18n();

  return (
    <>
      <section className="p70-hero p108-hero p120-hero p120-hero--enter" id="hero">
        <div className="p70-hero-glow" aria-hidden="true" />
        <div className="p70-wrap p70-hero-inner">
          <p className="p120-hero-badge" role="note">
            {t("hero.surfaceBadge")}
          </p>
          <p className="p70-kicker">{t("hero.kicker")}</p>
          <h1 className="p120-hero-h1">{t("hero.h1")}</h1>
          <p className="p70-tagline p108-tagline">{t("hero.tagline")}</p>
          <p className="p70-position-line">
            <strong>{t("hero.positionLead")}</strong> {t("hero.positionRest")}
          </p>
          <p className="p120-hero-runtime">
            {import.meta.env.DEV ? t("hero.devNote") : t("hero.publicNote")}
          </p>
          <div className="p70-hero-cta p120-hero-cta">
            <Link className="p70-btn p70-btn-primary p70-btn-lg p120-cta-primary" to={{ pathname: "/", hash: "#desktop" }}>
              {t("hero.cta.desktop")}
            </Link>
            <div className="p120-hero-cta-secondary">
              <div className="p120-hero-cta-links">
                <Link className="p70-btn p70-btn-lg p120-cta-secondary" to="/try">
                  {t("hero.cta.quickstart")}
                </Link>
                <Link className="p70-btn p70-btn-lg p120-cta-secondary" to="/try#try-demo">
                  {t("hero.cta.try")}
                </Link>
              </div>
              <span className="p120-hero-cta-hint">{t("hero.cta.secondaryHint")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="p70-section p108-section p120-section p131-quickstart" id="quickstart" data-p120-reveal>
        <div className="p70-wrap p131-quickstart-inner">
          <h2>{t("quickstart.h2")}</h2>
          <p className="p70-sub p108-sub">{t("quickstart.sub")}</p>
          <ol className="p131-quickstart-checklist">
            <li>{t("quickstart.li1")}</li>
            <li>{t("quickstart.li2")}</li>
            <li>{t("quickstart.li3")}</li>
          </ol>
          <p className="p131-quickstart-aside">{t("quickstart.aside")}</p>
          <div className="p131-quickstart-cta-row">
            <Link className="p70-btn p70-btn-primary p70-btn-lg" to={{ pathname: "/", hash: "#desktop" }}>
              {t("quickstart.cta")}
            </Link>
            <Link className="p70-btn p70-btn-ghost p70-btn-lg" to="/try">
              {t("nav.try")}
            </Link>
          </div>
        </div>
      </section>

      <section className="p70-section p108-section p120-section p134-story" id="story-token" data-p120-reveal>
        <div className="p70-wrap p134-story-grid">
          <div>
            <h2>{t("story.token.h2")}</h2>
            <p className="p70-sub p108-sub p134-story-p">{t("story.token.p1")}</p>
            <p className="p134-story-p2">{t("story.token.p2")}</p>
            <div className="p134-inline-links">
              <Link to="/try">{t("nav.try")}</Link>
              <span className="p134-link-sep" aria-hidden="true">
                ·
              </span>
              <Link to="/proof">{t("nav.proof")}</Link>
            </div>
          </div>
          <div>
            <h2>{t("story.validation.h2")}</h2>
            <p className="p70-sub p108-sub p134-story-p">{t("story.validation.p1")}</p>
            <p className="p134-story-p2">{t("story.validation.p2")}</p>
            <Link className="p70-inline-link" to="/docs">
              {t("nav.docs")}
            </Link>
          </div>
        </div>
      </section>

      <section className="p70-section p70-section-tint p108-section p120-section" id="audience" data-p120-reveal>
        <div className="p70-wrap">
          <h2>{t("audience.h2")}</h2>
          <p className="p70-sub p108-sub">{t("audience.sub")}</p>
          <div className="p108-why-grid">
            <article className="p70-card p70-card-elevated p108-card">
              <h3>{t("audience.c1.h")}</h3>
              <p>{t("audience.c1.p")}</p>
            </article>
            <article className="p70-card p70-card-elevated p108-card">
              <h3>{t("audience.c2.h")}</h3>
              <p>{t("audience.c2.p")}</p>
            </article>
            <article className="p70-card p70-card-elevated p108-card">
              <h3>{t("audience.c3.h")}</h3>
              <p>{t("audience.c3.p")}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="p70-section p108-section p120-section" id="usecases" data-p120-reveal>
        <div className="p70-wrap">
          <h2>{t("usecases.h2")}</h2>
          <p className="p70-sub p108-sub">{t("usecases.sub")}</p>
          <div className="p108-why-grid">
            <article className="p70-card p70-card-elevated p108-card">
              <h3>{t("usecases.u1.h")}</h3>
              <p>{t("usecases.u1.p")}</p>
            </article>
            <article className="p70-card p70-card-elevated p108-card">
              <h3>{t("usecases.u2.h")}</h3>
              <p>{t("usecases.u2.p")}</p>
            </article>
            <article className="p70-card p70-card-elevated p108-card">
              <h3>{t("usecases.u3.h")}</h3>
              <p>{t("usecases.u3.p")}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="p70-section p108-section p120-section" id="why" data-p120-reveal>
        <div className="p70-wrap">
          <h2>{t("why.h2")}</h2>
          <p className="p70-sub p108-sub">{t("why.sub")}</p>
          <div className="p108-why-grid">
            <article className="p70-card p70-card-elevated p108-card">
              <h3>{t("why.c1.h")}</h3>
              <p>{t("why.c1.p")}</p>
            </article>
            <article className="p70-card p70-card-elevated p108-card">
              <h3>{t("why.c2.h")}</h3>
              <p>{t("why.c2.p")}</p>
            </article>
            <article className="p70-card p70-card-elevated p108-card">
              <h3>{t("why.c3.h")}</h3>
              <p>{t("why.c3.p")}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="p70-section p108-section p120-section" id="proof" data-p120-reveal>
        <div className="p70-wrap">
          <h2>{t("bench.h2")}</h2>
          <p className="p70-sub p108-sub">{t("bench.sub")}</p>
          <p className="p134-teaser-label">{t("home.bench.teaser")}</p>
          <BenchmarkLive />
          <div className="p134-home-bench-links">
            <Link className="p70-btn p70-btn-ghost" to="/proof">
              {t("home.bench.linkProof")}
            </Link>
            <Link className="p70-btn p70-btn-ghost" to="/try">
              {t("home.bench.linkTry")}
            </Link>
          </div>
        </div>
      </section>

      <section className="p70-section p108-section p108-desktop p120-section" id="desktop" data-p120-reveal>
        <div className="p70-wrap">
          <h2>{t("desktop.h2")}</h2>
          <p className="p70-sub p108-sub">{t("desktop.sub")}</p>
          <div className="p70-card p70-card-wide p70-card-elevated p108-desktop-card">
            <p className="p108-desktop-lead">{t("desktop.body")}</p>
            <h3 className="p133-desktop-install-h">{t("desktop.install.h")}</h3>
            <ol className="p133-desktop-install-list">
              <li>{t("desktop.install.li1")}</li>
              <li>{t("desktop.install.li2")}</li>
              <li>{t("desktop.install.li3")}</li>
              <li>{t("desktop.install.li4")}</li>
            </ol>
            <div className="p134-desktop-cta-row">
              <Link className="p70-btn p70-btn-primary p70-btn-lg" to="/try">
                {t("desktop.cta")}
              </Link>
              <a className="p70-btn p70-btn-ghost p70-btn-lg" href="/desktop">
                {t("desktop.pointer")}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
