/**
 * P32: render flagship compression metrics with visible token reduction (console + desktop + site).
 */
(function (w) {
  "use strict";

  var LOCALE_KEY = "torqa-website-locale";

  function detectLocale() {
    try {
      var s = localStorage.getItem(LOCALE_KEY);
      if (s === "tr" || s === "en") return s;
    } catch (e) {
      /* ignore */
    }
    if (
      typeof navigator !== "undefined" &&
      navigator.language &&
      String(navigator.language).toLowerCase().substring(0, 2) === "tr"
    )
      return "tr";
    return "en";
  }

  var MSG = {
    en: {
      head: "P32 · Token reduction (est.)",
      heroSub: ".tq vs NL task",
      savings: "{saved} fewer tokens — surface is {pct}% of task size",
      nl: "NL task",
      tq: ".tq",
      note: "Flagship baseline · utf8÷4 estimate · multi-scenario proof: docs/TOKEN_PROOF.md",
    },
    tr: {
      head: "P32 · Token azaltma (tahm.)",
      heroSub: ".tq ve NL görev",
      savings: "{saved} daha az token — yüzey, görev büyüklüğünün {pct}%'i",
      nl: "NL görev",
      tq: ".tq",
      note: "Amiral gemisi · utf8÷4 tahmini · çok senaryolu kanıt: docs/TOKEN_PROOF.md",
    },
  };

  function t(key) {
    var loc = detectLocale();
    var pack = MSG[loc] || MSG.en;
    return pack[key] != null ? pack[key] : MSG.en[key] || key;
  }

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] != null ? String(vars[k]) : "{" + k + "}";
    });
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @param {Record<string, unknown>} m - report.metrics from /api/demo/benchmark-report
   * @returns {string} HTML fragment (numeric fields only — safe for innerHTML)
   */
  function torqaRenderBenchmarkPanel(m) {
    const task = Number(m.task_prompt_token_estimate);
    const tq = Number(m.torqa_source_token_estimate);
    if (!Number.isFinite(task) || !Number.isFinite(tq) || task < 1) return "";
    const ratioRaw = Number(m.semantic_compression_ratio);
    const ratio = Number.isFinite(ratioRaw) && ratioRaw > 0 ? ratioRaw : task / Math.max(1, tq);
    const saved = Math.max(0, Math.round(task - tq));
    const surfacePct = Math.min(100, Math.round((tq / task) * 100));
    const tqBarW = Math.min(100, (tq / task) * 100);
    const rStr = ratio >= 10 ? ratio.toFixed(1) : ratio.toFixed(2);
    const taskR = Math.round(task);
    const tqR = Math.round(tq);
    const savingsText = fill(t("savings"), { saved: String(saved), pct: String(surfacePct) });
    return (
      '<div class="tq-bm-panel">' +
      '<div class="tq-bm-head">' +
      esc(t("head")) +
      "</div>" +
      '<div class="tq-bm-hero"><span class="tq-bm-ratio">' +
      esc(rStr) +
      '×</span> <span class="tq-bm-hero-sub">' +
      esc(t("heroSub")) +
      "</span></div>" +
      '<p class="tq-bm-savings">' +
      esc(savingsText) +
      "</p>" +
      '<div class="tq-bm-bars" aria-hidden="true">' +
      '<div class="tq-bm-bar-row"><span class="tq-bm-bar-lab">' +
      esc(t("nl")) +
      '</span><div class="tq-bm-track"><div class="tq-bm-fill tq-bm-fill-nl" style="width:100%"></div></div><span class="tq-bm-bar-num">' +
      esc(String(taskR)) +
      '</span></div>' +
      '<div class="tq-bm-bar-row"><span class="tq-bm-bar-lab">' +
      esc(t("tq")) +
      '</span><div class="tq-bm-track"><div class="tq-bm-fill tq-bm-fill-tq" style="width:' +
      esc(String(tqBarW)) +
      '%"></div></div><span class="tq-bm-bar-num">' +
      esc(String(tqR)) +
      "</span></div>" +
      "</div>" +
      '<p class="tq-bm-note">' +
      esc(t("note")) +
      "</p>" +
      "</div>"
    );
  }

  w.torqaRenderBenchmarkPanel = torqaRenderBenchmarkPanel;
})(typeof window !== "undefined" ? window : globalThis);
