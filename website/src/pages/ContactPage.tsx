import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { publicContactEmail } from "../siteConfig";

export function ContactPage() {
  const { t } = useI18n();
  const email = publicContactEmail();
  return (
    <div className="p70-wrap p134-page">
      <h1 className="p134-page-h1">{t("lp.contact.h1")}</h1>
      <p className="p134-page-lead">{t("lp.contact.lead")}</p>
      <p className="p134-page-p">{t("lp.contact.p1")}</p>
      <p className="p134-page-p">{t("lp.contact.p2")}</p>
      {email ? (
        <p className="p134-contact-email-block">
          <span className="p134-page-note">{t("lp.contact.emailIntro")}</span>{" "}
          <a className="p70-btn p70-btn-primary" href={`mailto:${encodeURIComponent(email)}`}>
            {t("lp.contact.emailBtn")}
          </a>
        </p>
      ) : null}
      <div className="p134-page-cta-row">
        <Link className="p70-btn p70-btn-ghost" to="/docs">
          {t("nav.docs")}
        </Link>
        <Link className="p70-btn p70-btn-ghost" to="/">
          {t("nav.home")}
        </Link>
      </div>
    </div>
  );
}
