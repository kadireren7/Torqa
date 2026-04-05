import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fmtNum(v: unknown, digits = 3): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const s = v.toFixed(digits);
  return s.replace(/\.?0+$/, "");
}

export function ComparisonLaunchSummary() {
  const { t } = useI18n();
  const [data, setData] = useState<Record<string, unknown> | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetch("/static/shared/comparison_report.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        if (j && typeof j === "object" && !Array.isArray(j)) setData(j as Record<string, unknown>);
        else setData(null);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (data === undefined) {
    return (
      <p className="p136-site-muted" role="status">
        {t("p136.site.loading")}
      </p>
    );
  }
  if (!data) return null;

  const counts = isRecord(data.family_coverage_counts) ? data.family_coverage_counts : null;
  const flagship = isRecord(data.flagship_reference) ? data.flagship_reference : null;
  const web = flagship && isRecord(flagship.scenario_family_websites) ? flagship.scenario_family_websites : null;
  const tp = isRecord(data.token_proof_reference) ? data.token_proof_reference : null;
  const families = ["websites", "apps", "workflows", "automations"] as const;

  return (
    <section className="p136-site-block" aria-labelledby="p136-site-h">
      <div className="p136-site-head">
        <h2 id="p136-site-h" className="p136-site-h2">
          {t("p136.site.title")}
        </h2>
        <span className="p136-site-badge">{t("p136.site.badgeRef")}</span>
      </div>
      <p className="p136-site-lead">{t("p136.site.lead")}</p>
      {counts ? (
        <ul className="p136-site-families">
          {families.map((k) => (
            <li key={k}>
              <span>{t(`p136.site.family.${k}`)}</span>
              <strong>{typeof counts[k] === "number" ? counts[k] : "—"}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="p136-site-metrics">
        {web ? (
          <p>
            <strong>{t("p136.site.flagship")}</strong> — {t("p136.site.ratio")} {fmtNum(web.semantic_compression_ratio)}× ·{" "}
            {t("p136.site.taskTok")} {fmtNum(web.task_prompt_token_estimate, 0)} → {t("p136.site.tqTok")}{" "}
            {fmtNum(web.torqa_source_token_estimate, 0)}
          </p>
        ) : null}
        {tp ? (
          <p>
            <strong>{t("p136.site.tokenProof")}</strong> — {t("p136.site.avgCompress")}{" "}
            {fmtNum(tp.average_compression_ratio_prompt_per_torqa)}× · {t("p136.site.scenarios")}{" "}
            {typeof tp.passed_scenario_count === "number" ? tp.passed_scenario_count : "—"}/
            {typeof tp.scenario_count === "number" ? tp.scenario_count : "—"}
          </p>
        ) : null}
      </div>
      <p className="p136-site-live">{t("p136.site.live")}</p>
      <p className="p136-site-doc">{t("p136.site.doc")}</p>
    </section>
  );
}
