import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { BenchmarkLive } from "../widgets/BenchmarkLive";
import { ComparisonLaunchSummary } from "../widgets/ComparisonLaunchSummary";

export function ProofPage() {
  const { t } = useI18n();
  return (
    <div className="p70-wrap p134-page">
      <h1 className="p134-page-h1">{t("lp.proof.h1")}</h1>
      <p className="p134-page-lead">{t("lp.proof.lead")}</p>
      <ComparisonLaunchSummary />
      <BenchmarkLive />
      <p className="p134-page-note">{t("lp.proof.note")}</p>
      <div className="p134-page-cta-row">
        <Link className="p70-btn p70-btn-primary" to="/try">
          {t("nav.try")}
        </Link>
        <Link className="p70-btn p70-btn-ghost" to="/docs">
          {t("nav.docs")}
        </Link>
      </div>
    </div>
  );
}
