import { useCallback, useEffect, useState } from "react";
import type { Translate } from "./i18n/types";

type Props = { t: Translate; variant?: "sidebar" | "home" };

export function TrialFeedbackPanel({ t, variant = "sidebar" }: Props) {
  const [paths, setPaths] = useState<{
    dataDirectory: string;
    eventsFile: string;
    feedbackDirectory: string;
  } | null>(null);
  const [useful, setUseful] = useState<"yes" | "no" | "skip" | null>(null);
  const [failureCategory, setFailureCategory] = useState<string>("none");
  const [comment, setComment] = useState("");
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const shell = window.torqaShell;
    if (!shell?.trialGetInfo) return;
    void shell
      .trialGetInfo()
      .then((info) => {
        setPaths({
          dataDirectory: info.dataDirectory,
          eventsFile: info.eventsFile,
          feedbackDirectory: info.feedbackDirectory,
        });
      })
      .catch(() => {});
  }, []);

  const submit = useCallback(async () => {
    const shell = window.torqaShell;
    if (!shell?.trialSaveFeedback) {
      setErr(t("p135.feedback.err.bridge"));
      return;
    }
    setBusy(true);
    setErr(null);
    setSavedPath(null);
    const u = useful ?? "skip";
    const r = await shell.trialSaveFeedback({
      useful: u,
      failureCategory: failureCategory || "none",
      comment: comment.trim() || null,
    });
    setBusy(false);
    if (r.ok) {
      setSavedPath(r.path);
      setComment("");
      setUseful(null);
    } else {
      setErr(r.error);
    }
  }, [useful, failureCategory, comment, t]);

  const rootClass = variant === "home" ? "p135-feedback p135-feedback--home" : "p135-feedback";

  return (
    <details className={rootClass}>
      <summary className="p135-feedback-summary">{t("p135.feedback.summary")}</summary>
      <div className="p135-feedback-body">
        <p className="p135-feedback-privacy">{t("p135.feedback.privacy")}</p>
        {paths ? (
          <div className="p135-feedback-path-block">
            <p className="p135-feedback-paths">
              <span className="p135-feedback-path-label">{t("p135.feedback.pathsLabel")}</span>
              <code className="p135-feedback-code" title={paths.dataDirectory}>
                {paths.dataDirectory}
              </code>
            </p>
            <p className="p135-feedback-paths">
              <span className="p135-feedback-path-label">{t("p135.feedback.eventsLabel")}</span>
              <code className="p135-feedback-code" title={paths.eventsFile}>
                {paths.eventsFile}
              </code>
            </p>
            <p className="p135-feedback-paths">
              <span className="p135-feedback-path-label">{t("p135.feedback.feedbackDirLabel")}</span>
              <code className="p135-feedback-code" title={paths.feedbackDirectory}>
                {paths.feedbackDirectory}
              </code>
            </p>
          </div>
        ) : null}
        <p className="p135-feedback-doc">{t("p135.feedback.docHint")}</p>

        <div className="p135-feedback-field">
          <span className="p135-feedback-label">{t("p135.feedback.usefulQ")}</span>
          <div className="p135-feedback-chips" role="group" aria-label={t("p135.feedback.usefulQ")}>
            <button
              type="button"
              className={`btn btn-compact${useful === "yes" ? " btn-primary" : ""}`}
              onClick={() => setUseful("yes")}
            >
              {t("p135.feedback.usefulYes")}
            </button>
            <button
              type="button"
              className={`btn btn-compact${useful === "no" ? " btn-primary" : ""}`}
              onClick={() => setUseful("no")}
            >
              {t("p135.feedback.usefulNo")}
            </button>
            <button
              type="button"
              className={`btn btn-compact${useful === "skip" || useful === null ? " btn-primary" : ""}`}
              onClick={() => setUseful("skip")}
            >
              {t("p135.feedback.usefulSkip")}
            </button>
          </div>
        </div>

        <label className="p135-feedback-field">
          <span className="p135-feedback-label">{t("p135.feedback.failedQ")}</span>
          <select
            className="p135-feedback-select"
            value={failureCategory}
            onChange={(e) => setFailureCategory(e.target.value)}
          >
            <option value="none">{t("p135.feedback.fail.none")}</option>
            <option value="build">{t("p135.feedback.fail.build")}</option>
            <option value="validation">{t("p135.feedback.fail.validation")}</option>
            <option value="preview">{t("p135.feedback.fail.preview")}</option>
            <option value="generation">{t("p135.feedback.fail.generation")}</option>
            <option value="other">{t("p135.feedback.fail.other")}</option>
          </select>
        </label>

        <label className="p135-feedback-field">
          <span className="p135-feedback-label">{t("p135.feedback.commentLabel")}</span>
          <textarea
            className="p135-feedback-textarea"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("p135.feedback.commentPh")}
          />
        </label>

        <button type="button" className="btn btn-compact" disabled={busy} onClick={() => void submit()}>
          {busy ? t("p135.feedback.saving") : t("p135.feedback.save")}
        </button>

        {savedPath ? (
          <p className="p135-feedback-saved" role="status">
            {t("p135.feedback.saved", { path: savedPath })}
          </p>
        ) : null}
        {err ? (
          <p className="p135-feedback-err" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    </details>
  );
}
