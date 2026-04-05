import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

export function DocsPage() {
  const { t } = useI18n();
  const items = [
    "lp.docs.try",
    "lp.docs.quick",
    "lp.docs.comparison",
    "lp.docs.limits",
    "lp.docs.desktop",
    "lp.docs.map",
  ] as const;
  return (
    <div className="p70-wrap p134-page">
      <h1 className="p134-page-h1">{t("lp.docs.h1")}</h1>
      <p className="p134-page-lead">{t("lp.docs.lead")}</p>
      <ul className="p134-doc-list">
        {items.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
      <p className="p134-page-note">{t("lp.docs.console")}</p>
      <div className="p134-page-cta-row">
        <Link className="p70-btn p70-btn-primary" to="/try">
          {t("nav.try")}
        </Link>
        <Link className="p70-btn p70-btn-ghost" to="/proof">
          {t("nav.proof")}
        </Link>
      </div>
    </div>
  );
}
