import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

export function ProductPage() {
  const { t } = useI18n();
  return (
    <div className="p70-wrap p134-page">
      <h1 className="p134-page-h1">{t("lp.product.h1")}</h1>
      <p className="p134-page-lead">{t("lp.product.lead")}</p>
      <p className="p134-page-p">{t("lp.product.p1")}</p>
      <p className="p134-page-p">{t("lp.product.p2")}</p>
      <div className="p134-page-cta-row">
        <Link className="p70-btn p70-btn-primary" to="/try">
          {t("lp.product.linkTry")}
        </Link>
        <Link className="p70-btn p70-btn-ghost" to="/proof">
          {t("lp.product.linkProof")}
        </Link>
        <Link className="p70-btn p70-btn-ghost" to={{ pathname: "/", hash: "#desktop" }}>
          {t("nav.getApp")}
        </Link>
      </div>

      <h2 className="p134-page-h2">{t("audience.h2")}</h2>
      <p className="p70-sub p108-sub">{t("audience.sub")}</p>
      <div className="p108-why-grid p134-page-grid">
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

      <h2 className="p134-page-h2">{t("usecases.h2")}</h2>
      <p className="p70-sub p108-sub">{t("usecases.sub")}</p>
      <div className="p108-why-grid p134-page-grid">
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
  );
}
