import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

type BenchMetrics = {
  task_prompt_token_estimate?: number;
  torqa_source_token_estimate?: number;
  semantic_compression_ratio?: number;
};

export function BenchmarkLive() {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<BenchMetrics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/demo/benchmark-report");
        const d = (await r.json()) as { ok?: boolean; report?: { metrics?: BenchMetrics } };
        if (cancelled) return;
        if (d.ok && d.report?.metrics) setMetrics(d.report.metrics);
        else setErr(t("bm.err.preview"));
      } catch {
        if (!cancelled) setErr(t("bm.err.connect"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const task = metrics?.task_prompt_token_estimate ?? 0;
  const tq = metrics?.torqa_source_token_estimate ?? 0;
  const ratio =
    typeof metrics?.semantic_compression_ratio === "number"
      ? metrics.semantic_compression_ratio
      : task > 0 && tq > 0
        ? task / Math.max(1, tq)
        : null;

  const nlPct = task > 0 ? 100 : 0;
  const tqPct = task > 0 ? Math.min(100, (tq / task) * 100) : 0;

  return (
    <div className="p70-bm-live p108-bm">
      {err && !metrics ? <p className="p70-bm-note">{err}</p> : null}
      {metrics && task > 0 && tq > 0 ? (
        <>
          {ratio != null ? <div className="p70-bm-ratio p120-bm-ratio">{ratio.toFixed(2)}×</div> : null}
          <p className="p70-bm-caption">{t("bm.caption")}</p>
          <div className="p70-bm-bars">
            <div className="p70-bm-row">
              <span>{t("bm.row.nl")}</span>
              <div className="p70-bm-track">
                <div className="p70-bm-fill p70-bm-fill-nl" style={{ width: `${nlPct}%` }} />
              </div>
              <span>{Math.round(task)}</span>
            </div>
            <div className="p70-bm-row">
              <span>{t("bm.row.tq")}</span>
              <div className="p70-bm-track">
                <div className="p70-bm-fill p70-bm-fill-tq" style={{ width: `${tqPct}%` }} />
              </div>
              <span>{Math.round(tq)}</span>
            </div>
          </div>
        </>
      ) : metrics ? (
        <p className="p70-bm-note">{t("bm.incomplete")}</p>
      ) : !err ? (
        <p className="p70-bm-note">{t("bm.loading")}</p>
      ) : null}
    </div>
  );
}
