import { useCallback, useEffect, useState } from "react";
import { useI18n } from "./i18n";
import {
  VENDOR_REFERENCE_PROFILES,
  costUsdReference,
  costReductionVsNlPct,
  inputReductionVsTorqaPct,
  type ReferenceAggregate,
  type VendorReferenceProfile,
} from "./modelCompareReference";

const STORAGE_KEYS = "torqa_p107_api_prefs_v1";

type StoredKeys = {
  openai: string;
  anthropic: string;
  google: string;
};

function loadStoredKeys(): StoredKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS);
    if (!raw) return { openai: "", anthropic: "", google: "" };
    const j = JSON.parse(raw) as Partial<StoredKeys>;
    return {
      openai: typeof j.openai === "string" ? j.openai : "",
      anthropic: typeof j.anthropic === "string" ? j.anthropic : "",
      google: typeof j.google === "string" ? j.google : "",
    };
  } catch {
    return { openai: "", anthropic: "", google: "" };
  }
}

function fmtTok(n: number): string {
  return Math.round(n).toLocaleString();
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n < 1e-4) return n.toFixed(6);
  return n.toFixed(4);
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

type Props = {
  aggregate: ReferenceAggregate | null;
};

export function ModelComparePanel({ aggregate }: Props) {
  const { t } = useI18n();
  const [keys, setKeys] = useState<StoredKeys>(() => loadStoredKeys());
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setKeys(loadStoredKeys());
  }, []);

  const saveKeys = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS, JSON.stringify(keys));
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } catch {
      /* ignore */
    }
  }, [keys]);

  const inRed = aggregate
    ? inputReductionVsTorqaPct(aggregate.avgPromptIn, aggregate.avgTorqaIn)
    : null;

  return (
    <div className="p107-model-compare">
      <div className="p107-mode-badge p107-mode-badge--ref" role="status">
        {t("modelCompare.badge.reference")}
      </div>
      <p className="p107-lead">{t("modelCompare.lead")}</p>
      <p className="p107-ref-disclaimer">{t("modelCompare.p123.referenceOnly")}</p>

      {!aggregate ? (
        <div className="empty-hint p107-empty">{t("modelCompare.empty")}</div>
      ) : (
        <>
          <div className="p107-table-wrap" role="region" aria-label={t("modelCompare.table.aria")}>
            <table className="p107-table">
              <thead>
                <tr>
                  <th scope="col" className="p107-th-metric">
                    {t("modelCompare.th.metric")}
                  </th>
                  <th scope="col">{t("modelCompare.th.torqa")}</th>
                  {VENDOR_REFERENCE_PROFILES.map((p) => (
                    <th key={p.id} scope="col">
                      {t(`modelCompare.th.${p.id}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{t("modelCompare.row.input")}</th>
                  <td>{fmtTok(aggregate.avgTorqaIn)}</td>
                  {VENDOR_REFERENCE_PROFILES.map((p) => (
                    <td key={`in-${p.id}`}>{fmtTok(aggregate.avgPromptIn)}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{t("modelCompare.row.output")}</th>
                  <td>{fmtTok(aggregate.avgIrOut)}</td>
                  {VENDOR_REFERENCE_PROFILES.map((p) => (
                    <td key={`out-${p.id}`}>{fmtTok(aggregate.avgLlmOutput)}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{t("modelCompare.row.totalCost")}</th>
                  <td>
                    <div className="p107-cost-stack">
                      {VENDOR_REFERENCE_PROFILES.map((p) => (
                        <div key={p.id}>
                          <span className="p107-cost-k">{t(`modelCompare.short.${p.id}`)}</span>{" "}
                          <span className="p107-cost-v">
                            ${fmtUsd(costUsdReference(aggregate.avgTorqaIn, aggregate.avgIrOut, p))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  {VENDOR_REFERENCE_PROFILES.map((p) => (
                    <VendorCostCells key={p.id} aggregate={aggregate} profile={p} />
                  ))}
                </tr>
                <tr>
                  <th scope="row">{t("modelCompare.row.retries")}</th>
                  <td>{t("modelCompare.retries.na")}</td>
                  {VENDOR_REFERENCE_PROFILES.map((p) => (
                    <td key={`ret-${p.id}`}>{t("modelCompare.retries.na")}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{t("modelCompare.row.inRedTorqa")}</th>
                  <td>—</td>
                  {VENDOR_REFERENCE_PROFILES.map((p) => (
                    <td key={`ired-${p.id}`}>{fmtPct(inRed)}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{t("modelCompare.row.costRedTorqa")}</th>
                  <td>—</td>
                  {VENDOR_REFERENCE_PROFILES.map((p) => (
                    <td key={`cred-${p.id}`}>
                      {fmtPct(
                        costReductionVsNlPct(
                          costUsdReference(aggregate.avgPromptIn, aggregate.avgLlmOutput, p),
                          costUsdReference(aggregate.avgTorqaIn, aggregate.avgIrOut, p),
                        ),
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <ul className="p107-footnotes">
            <li>{t("modelCompare.note.suite", { id: aggregate.suiteId || "—", n: String(aggregate.passedCount) })}</li>
            <li>{t("modelCompare.note.estimator", { id: aggregate.estimatorId })}</li>
            <li>{t("modelCompare.note.tokens")}</li>
            <li>{t("modelCompare.note.llmOut")}</li>
            <li>{t("modelCompare.note.torqaOut")}</li>
            <li>{t("modelCompare.note.pricing")}</li>
            <li>{t("modelCompare.note.costRow")}</li>
          </ul>
        </>
      )}

      <details className="p107-advanced">
        <summary>{t("modelCompare.advanced.summary")}</summary>
        <p className="p107-advanced-lead">{t("modelCompare.advanced.lead")}</p>
        <div className="p107-mode-badge p107-mode-badge--live" role="status">
          {t("modelCompare.badge.live")}
        </div>
        <p className="p107-live-status">{t("modelCompare.live.whereToSee")}</p>
        <p className="p107-live-status p107-live-status--muted">{t("modelCompare.live.notImplemented")}</p>
        <p className="p107-key-redirect">{t("modelCompare.p123.useMainKeys")}</p>
        <div className="p107-key-grid">
          <label className="p107-key-field">
            <span>{t("modelCompare.key.openai")}</span>
            <input
              type="password"
              autoComplete="off"
              value={keys.openai}
              onChange={(e) => setKeys((k) => ({ ...k, openai: e.target.value }))}
              placeholder={t("modelCompare.key.placeholder")}
            />
          </label>
          <label className="p107-key-field">
            <span>{t("modelCompare.key.anthropic")}</span>
            <input
              type="password"
              autoComplete="off"
              value={keys.anthropic}
              onChange={(e) => setKeys((k) => ({ ...k, anthropic: e.target.value }))}
              placeholder={t("modelCompare.key.placeholder")}
            />
          </label>
          <label className="p107-key-field">
            <span>{t("modelCompare.key.google")}</span>
            <input
              type="password"
              autoComplete="off"
              value={keys.google}
              onChange={(e) => setKeys((k) => ({ ...k, google: e.target.value }))}
              placeholder={t("modelCompare.key.placeholder")}
            />
          </label>
        </div>
        <p className="p107-key-warning">{t("modelCompare.key.warning")}</p>
        <button type="button" className="btn btn-compact p107-key-save" onClick={() => void saveKeys()}>
          {t("modelCompare.key.save")}
        </button>
        {savedFlash ? <span className="p107-key-saved">{t("modelCompare.key.saved")}</span> : null}
      </details>
    </div>
  );
}

function VendorCostCells({ aggregate, profile }: { aggregate: ReferenceAggregate; profile: VendorReferenceProfile }) {
  const nl = costUsdReference(aggregate.avgPromptIn, aggregate.avgLlmOutput, profile);
  const tq = costUsdReference(aggregate.avgTorqaIn, aggregate.avgIrOut, profile);
  const { t } = useI18n();
  return (
    <td>
      <div className="p107-cost-stack">
        <div>
          <span className="p107-cost-k">{t("modelCompare.cost.nl")}</span>{" "}
          <span className="p107-cost-v">${fmtUsd(nl)}</span>
        </div>
        <div>
          <span className="p107-cost-k">{t("modelCompare.cost.torqa")}</span>{" "}
          <span className="p107-cost-v">${fmtUsd(tq)}</span>
        </div>
      </div>
    </td>
  );
}
