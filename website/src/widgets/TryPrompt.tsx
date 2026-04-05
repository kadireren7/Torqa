import { useCallback, useState } from "react";
import { useI18n } from "../i18n";

type TryPromptPreviewOk = {
  ok: true;
  tq_gen_intent: string;
  prompt_token_estimate: number;
  tq_token_estimate: number;
  compression_ratio_prompt_per_tq: number;
  reduction_percent_vs_prompt: number | null;
  tq_source_preview: string;
  disclaimer_en: string;
};

export function HeroTryPrompt() {
  const { t } = useI18n();
  const [demo, setDemo] = useState(() => t("demo.defaultPrompt"));
  const [preview, setPreview] = useState<TryPromptPreviewOk | null>(null);
  const [snapshotPrompt, setSnapshotPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prevErr, setPrevErr] = useState<string | null>(null);

  const runLivePreview = useCallback(async () => {
    const promptText = demo.trim().slice(0, 14000);
    if (!promptText) {
      setPrevErr(t("demo.err.empty"));
      setPreview(null);
      return;
    }
    setLoading(true);
    setPrevErr(null);
    setPreview(null);
    setSnapshotPrompt(null);
    try {
      const r = await fetch("/api/demo/try-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });
      const d = (await r.json()) as Record<string, unknown>;
      if (!r.ok) {
        const det = d.detail;
        setPrevErr(typeof det === "string" ? det : t("demo.err.request"));
        return;
      }
      if (d.ok !== true) {
        setPrevErr(typeof d.message === "string" ? d.message : t("demo.err.build"));
        return;
      }
      setSnapshotPrompt(promptText);
      setPreview(d as unknown as TryPromptPreviewOk);
    } catch {
      setPrevErr(t("demo.err.server"));
    } finally {
      setLoading(false);
    }
  }, [demo, t]);

  const pt = preview?.prompt_token_estimate ?? 0;
  const tt = preview?.tq_token_estimate ?? 0;
  const ratio = preview?.compression_ratio_prompt_per_tq ?? null;
  const nlPct = pt > 0 ? 100 : 0;
  const tqPct = pt > 0 ? Math.min(100, (tt / pt) * 100) : 0;

  return (
    <div className="p80-hero-demo p108-try-demo" id="try-demo" role="region" aria-label={t("demo.region.aria")} aria-busy={loading}>
      <h3 className="p108-try-demo-title">{t("demo.title")}</h3>
      <p className="p108-try-demo-sub">{t("demo.sub")}</p>
      <p className="p120-demo-api-hint">{t("demo.apiHint")}</p>
      <label className="p80-hero-demo-field-label" htmlFor="torqa-live-demo-prompt">
        {t("demo.label.prompt")}
      </label>
      <textarea
        id="torqa-live-demo-prompt"
        className="p80-hero-demo-input"
        value={demo}
        onChange={(e) => setDemo(e.target.value)}
        rows={3}
        aria-label={t("demo.aria.prompt")}
      />
      <div className="p108-try-demo-actions">
        <button type="button" className="p70-btn p70-btn-ghost" onClick={() => setDemo(t("demo.defaultPrompt"))}>
          {t("demo.example")}
        </button>
      </div>
      <div className="p80-live-demo-actions">
        <button
          type="button"
          className="p70-btn p70-btn-primary"
          onClick={() => void runLivePreview()}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? t("demo.btn.running") : t("demo.btn.run")}
        </button>
        <span className="p80-live-demo-actions-note">{t("demo.note.api")}</span>
      </div>
      {prevErr ? (
        <p className="p80-live-demo-err" role="alert">
          {prevErr}
        </p>
      ) : null}
      {!preview && !prevErr && !loading ? (
        <div className="p80-results-preview-placeholder">
          <p className="p80-results-preview-placeholder-text">{t("demo.results.placeholder")}</p>
        </div>
      ) : null}
      {loading ? (
        <div className="p80-results-preview-shell p80-results-preview-shell--loading" aria-live="polite">
          <div className="p80-results-preview-chrome">
            <span className="p80-results-preview-dots" aria-hidden="true">
              <i /> <i /> <i />
            </span>
            <span className="p80-results-preview-chrome-title">{t("demo.results.title")}</span>
          </div>
          <div className="p80-results-preview-body">
            <p className="p80-results-preview-loading-msg">{t("demo.loading")}</p>
          </div>
        </div>
      ) : null}
      {preview ? (
        <div className="p80-results-preview-shell" aria-live="polite">
          <div className="p80-results-preview-chrome">
            <span className="p80-results-preview-dots" aria-hidden="true">
              <i /> <i /> <i />
            </span>
            <span className="p80-results-preview-chrome-title">{t("demo.results.title")}</span>
          </div>
          <div className="p80-results-preview-body">
            <div className="p80-live-preview-head">
              <span className="p80-live-preview-badge">{t("demo.profile", { intent: preview.tq_gen_intent })}</span>
              {ratio != null ? (
                <span className="p80-live-preview-ratio p120-live-ratio">{ratio.toFixed(2)}×</span>
              ) : null}
            </div>
            {ratio != null ? <p className="p80-live-preview-caption">{t("demo.caption.bars")}</p> : null}
            <div className="p70-bm-bars p80-live-preview-bars">
              <div className="p70-bm-row">
                <span>{t("demo.bar.yourPrompt")}</span>
                <div className="p70-bm-track">
                  <div className="p70-bm-fill p70-bm-fill-nl" style={{ width: `${nlPct}%` }} />
                </div>
                <span>{Math.round(pt)}</span>
              </div>
              <div className="p70-bm-row">
                <span>{t("demo.bar.templateTq")}</span>
                <div className="p70-bm-track">
                  <div className="p70-bm-fill p70-bm-fill-tq" style={{ width: `${tqPct}%` }} />
                </div>
                <span>{Math.round(tt)}</span>
              </div>
            </div>
            {preview.reduction_percent_vs_prompt != null ? (
              <p className="p80-live-preview-reduction">
                {t("demo.reduction", { pct: preview.reduction_percent_vs_prompt.toFixed(1) })}
              </p>
            ) : null}
            <div className="p80-results-preview-split">
              <div className="p80-results-preview-col">
                <div className="p80-results-preview-col-head">{t("demo.col.ran")}</div>
                <pre className="p80-live-preview-nl" tabIndex={0}>
                  {(snapshotPrompt ?? demo).trim()}
                </pre>
              </div>
              <div className="p80-results-preview-col">
                <div className="p80-results-preview-col-head">{t("demo.col.surface")}</div>
                <pre className="p80-live-preview-tq" tabIndex={0}>
                  {preview.tq_source_preview.trimEnd()}
                </pre>
              </div>
            </div>
            <p className="p80-live-preview-disclaimer">{preview.disclaimer_en}</p>
          </div>
        </div>
      ) : null}
      <p className="p108-try-foot">{t("demo.hint.desktop")}</p>
    </div>
  );
}
