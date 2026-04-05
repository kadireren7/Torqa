import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { HeroTryPrompt } from "../widgets/TryPrompt";

export function TryPage() {
  const { t } = useI18n();
  return (
    <div className="p70-wrap p134-page p134-try-page">
      <h1 className="p134-page-h1">{t("lp.try.h1")}</h1>
      <p className="p134-page-lead">{t("lp.try.lead")}</p>

      <section className="p134-try-section" aria-labelledby="try-quickstart-h2">
        <h2 id="try-quickstart-h2">{t("quickstart.h2")}</h2>
        <p className="p70-sub p108-sub">{t("quickstart.sub")}</p>
        <ol className="p131-quickstart-checklist">
          <li>{t("quickstart.li1")}</li>
          <li>{t("quickstart.li2")}</li>
          <li>{t("quickstart.li3")}</li>
        </ol>
        <p className="p131-quickstart-aside">{t("quickstart.aside")}</p>
        <Link className="p70-btn p70-btn-primary p70-btn-lg" to={{ pathname: "/", hash: "#desktop" }}>
          {t("quickstart.cta")}
        </Link>
      </section>

      <section className="p134-try-section p134-try-steps" aria-labelledby="try-steps-h2">
        <h2 id="try-steps-h2">{t("steps.h2")}</h2>
        <p className="p70-sub p108-sub">{t("steps.sub")}</p>
        <ol className="p108-step-list">
          <li>
            <span className="p108-step-num">1</span>
            <div>
              <h3 className="p108-step-title">{t("steps.s1.h")}</h3>
              <p className="p108-step-p">{t("steps.s1.p")}</p>
            </div>
          </li>
          <li>
            <span className="p108-step-num">2</span>
            <div>
              <h3 className="p108-step-title">{t("steps.s2.h")}</h3>
              <p className="p108-step-p">{t("steps.s2.p")}</p>
            </div>
          </li>
          <li>
            <span className="p108-step-num">3</span>
            <div>
              <h3 className="p108-step-title">{t("steps.s3.h")}</h3>
              <p className="p108-step-p">{t("steps.s3.p")}</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="p70-section-tint p134-try-demo-wrap">
        <HeroTryPrompt />
      </section>
    </div>
  );
}
