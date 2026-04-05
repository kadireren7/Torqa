import type { Translate } from "./i18n/types";

type Props = {
  t: Translate;
  report: Record<string, unknown> | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fmtNum(v: unknown, digits = 3): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const s = v.toFixed(digits);
  return s.replace(/\.?0+$/, "");
}

const PREFERRED_FAMILY_KEYS = ["websites", "apps", "workflows", "automations"] as const;

function familyLabel(t: Translate, k: string): string {
  const i18nKey = `p136.family.${k}`;
  const msg = t(i18nKey);
  if (msg !== i18nKey) return msg;
  return k
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function orderedNumericFamilyKeys(counts: Record<string, unknown>): string[] {
  const keys = Object.keys(counts).filter((k) => typeof counts[k] === "number");
  const preferred = PREFERRED_FAMILY_KEYS.filter((k) => keys.includes(k));
  const preferredSet = new Set<string>(preferred);
  const rest = keys.filter((k) => !preferredSet.has(k)).sort();
  return [...preferred, ...rest];
}

export function ComparisonSummaryPanel({ t, report }: Props) {
  if (!report) {
    return <div className="empty-hint p136-summary-empty">{t("p136.summary.empty")}</div>;
  }

  const counts = isRecord(report.family_coverage_counts) ? report.family_coverage_counts : null;
  const flagship = isRecord(report.flagship_reference) ? report.flagship_reference : null;
  const web = flagship && isRecord(flagship.scenario_family_websites) ? flagship.scenario_family_websites : null;
  const tp = isRecord(report.token_proof_reference) ? report.token_proof_reference : null;

  const familyKeys = counts ? orderedNumericFamilyKeys(counts) : [];

  return (
    <section className="p136-desktop-summary" aria-labelledby="p136-desktop-summary-h">
      <div className="p136-desktop-summary-head">
        <h3 id="p136-desktop-summary-h">{t("p136.summary.title")}</h3>
        <span className="p136-desktop-summary-badge" role="status">
          {t("p136.summary.badgeRef")}
        </span>
      </div>
      <p className="p136-desktop-summary-honesty">{t("p136.summary.honestyShort")}</p>
      {counts ? (
        <div className="p136-desktop-families">
          <div className="p136-desktop-families-label">{t("p136.summary.families")}</div>
          <ul className="p136-desktop-families-list">
            {familyKeys.map((k) => (
              <li key={k}>
                <span>{familyLabel(t, k)}</span>
                <span className="p136-desktop-families-n">{typeof counts[k] === "number" ? counts[k] : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="p136-desktop-metrics">
        {web ? (
          <p>
            <strong>{t("p136.summary.flagship")}</strong> — {t("p136.summary.ratio")}{" "}
            {fmtNum(web.semantic_compression_ratio)}× · {t("p136.summary.taskTok")} {fmtNum(web.task_prompt_token_estimate, 0)}{" "}
            → {t("p136.summary.tqTok")} {fmtNum(web.torqa_source_token_estimate, 0)}
          </p>
        ) : null}
        {tp ? (
          <p>
            <strong>{t("p136.summary.tokenProof")}</strong> — {t("p136.summary.avgCompress")}{" "}
            {fmtNum(tp.average_compression_ratio_prompt_per_torqa)}× · {t("p136.summary.scenarios")}{" "}
            {typeof tp.passed_scenario_count === "number" ? tp.passed_scenario_count : "—"}/
            {typeof tp.scenario_count === "number" ? tp.scenario_count : "—"}
          </p>
        ) : null}
        <p className="p136-desktop-live-note">{t("p136.summary.liveNote")}</p>
        <p className="p136-desktop-doc">{t("p136.summary.doc")}</p>
      </div>
    </section>
  );
}
