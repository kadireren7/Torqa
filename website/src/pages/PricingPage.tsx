import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

export function PricingPage() {
  const { t } = useI18n();
  return (
    <div className="p70-wrap p134-page">
      <h1 className="p134-page-h1">{t("lp.pricing.h1")}</h1>
      <p className="p134-page-lead">{t("lp.pricing.lead")}</p>
      <div className="p70-card p70-card-elevated p134-pricing-card">
        <ul className="p134-doc-list p134-pricing-list">
          <li>{t("lp.pricing.b1")}</li>
          <li>{t("lp.pricing.b2")}</li>
        </ul>
        <Link className="p70-btn p70-btn-primary" to="/contact">
          {t("lp.pricing.cta")}
        </Link>
      </div>
    </div>
  );
}
