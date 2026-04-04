import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";

const THEME_KEY = "torqa-website-theme";

type BenchMetrics = {
  task_prompt_token_estimate?: number;
  torqa_source_token_estimate?: number;
  semantic_compression_ratio?: number;
};

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const s = localStorage.getItem(THEME_KEY);
    if (s === "light" || s === "dark") {
      setTheme(s);
      document.documentElement.setAttribute("data-theme", s);
      return;
    }
    const prefers =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    const t = prefers ? "light" : "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  }, [theme]);

  return { theme, toggle };
}

type TryPromptPreviewOk = {
  ok: true;
  tq_gen_intent: string;
  template_relative_path: string;
  prompt_token_estimate: number;
  tq_token_estimate: number;
  compression_ratio_prompt_per_tq: number;
  reduction_percent_vs_prompt: number | null;
  tq_source_preview: string;
  disclaimer_en: string;
  estimator_id: string;
};

function HeroTryPrompt() {
  const [demo, setDemo] = useState(
    "A minimal sign-in flow with username, password, and audit-friendly fields.",
  );
  const [preview, setPreview] = useState<TryPromptPreviewOk | null>(null);
  /** Prompt text that produced the current preview (stable if user edits the textarea after). */
  const [snapshotPrompt, setSnapshotPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prevErr, setPrevErr] = useState<string | null>(null);

  const examples: { label: string; text: string }[] = useMemo(
    () => [
      {
        label: "Landing page",
        text: "A modern landing page with a hero headline, three benefit cards, social proof strip, and a strong primary call-to-action.",
      },
      {
        label: "Simple app",
        text: "A simple web app: sign-in with email and password, then a home screen that shows a welcome message and one primary action.",
      },
      {
        label: "Automation",
        text: "An automation workflow: trigger event, human approval step, then success or failure with timestamps and actor fields for audit.",
      },
    ],
    [],
  );

  const runLivePreview = useCallback(async () => {
    const t = demo.trim().slice(0, 14000);
    if (!t) {
      setPrevErr("Enter a prompt first.");
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
        body: JSON.stringify({ prompt: t }),
      });
      const d = (await r.json()) as Record<string, unknown>;
      if (!r.ok) {
        const det = d.detail;
        setPrevErr(typeof det === "string" ? det : "Preview request failed.");
        return;
      }
      if (d.ok !== true) {
        setPrevErr(typeof d.message === "string" ? d.message : "Could not build preview.");
        return;
      }
      setSnapshotPrompt(t);
      setPreview(d as unknown as TryPromptPreviewOk);
    } catch {
      setPrevErr("Open this site via the local server (torqa-console) to run the live demo.");
    } finally {
      setLoading(false);
    }
  }, [demo]);

  const pt = preview?.prompt_token_estimate ?? 0;
  const tt = preview?.tq_token_estimate ?? 0;
  const ratio = preview?.compression_ratio_prompt_per_tq ?? null;
  const nlPct = pt > 0 ? 100 : 0;
  const tqPct = pt > 0 ? Math.min(100, (tt / pt) * 100) : 0;

  return (
    <div
      className="p80-hero-demo"
      id="try"
      role="region"
      aria-label="Live demo: try a prompt and open the results preview"
      aria-busy={loading}
    >
      <h2 className="p80-live-demo-heading">Live demo</h2>
      <p className="p80-hero-demo-kicker">Try a prompt and see a results preview instantly.</p>
      <p className="p80-hero-demo-label">No sign-up · deterministic template + token bars</p>
      <label className="p80-hero-demo-field-label" htmlFor="torqa-live-demo-prompt">
        Your prompt
      </label>
      <textarea
        id="torqa-live-demo-prompt"
        className="p80-hero-demo-input"
        value={demo}
        onChange={(e) => setDemo(e.target.value)}
        rows={3}
        aria-label="Your prompt for the live demo"
      />
      <div className="p80-hero-demo-chips">
        {examples.map((ex) => (
          <button key={ex.label} type="button" className="p80-chip" onClick={() => setDemo(ex.text)} title={ex.text}>
            {ex.label}
          </button>
        ))}
      </div>
      <div className="p80-live-demo-actions">
        <button
          type="button"
          className="p70-btn p70-btn-primary"
          onClick={() => void runLivePreview()}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? "Running..." : "Run results preview"}
        </button>
        <span className="p80-live-demo-actions-note">Uses the local server API — open via torqa-console</span>
      </div>
      {prevErr ? (
        <p className="p80-live-demo-err" role="alert">
          {prevErr}
        </p>
      ) : null}
      {!preview && !prevErr && !loading ? (
        <div className="p80-results-preview-placeholder">
          <span className="p80-results-preview-placeholder-title">Results preview</span>
          <p className="p80-results-preview-placeholder-text">
            Token comparison and illustrative <code className="p80-code">.tq</code> surface appear here after you run the preview.
          </p>
        </div>
      ) : null}
      {loading ? (
        <div className="p80-results-preview-shell p80-results-preview-shell--loading" aria-live="polite">
          <div className="p80-results-preview-chrome">
            <span className="p80-results-preview-dots" aria-hidden="true">
              <i /> <i /> <i />
            </span>
            <span className="p80-results-preview-chrome-title">Results preview</span>
          </div>
          <div className="p80-results-preview-body">
            <p className="p80-results-preview-loading-msg">Building preview - matching profile and template...</p>
            <div className="p80-results-preview-skeleton" aria-hidden="true">
              <div className="p80-results-preview-skeleton-bar" />
              <div className="p80-results-preview-skeleton-bar p80-results-preview-skeleton-bar--short" />
              <div className="p80-results-preview-skeleton-split">
                <div className="p80-results-preview-skeleton-block" />
                <div className="p80-results-preview-skeleton-block" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {preview ? (
        <div className="p80-results-preview-shell" aria-live="polite">
          <div className="p80-results-preview-chrome">
            <span className="p80-results-preview-dots" aria-hidden="true">
              <i /> <i /> <i />
            </span>
            <span className="p80-results-preview-chrome-title">Results preview</span>
          </div>
          <div className="p80-results-preview-body">
            <div className="p80-live-preview-head">
              <span className="p80-live-preview-badge">Profile: {preview.tq_gen_intent}</span>
              {ratio != null ? <span className="p80-live-preview-ratio">{ratio.toFixed(2)}×</span> : null}
              <span className="p80-live-preview-meta">{preview.estimator_id}</span>
            </div>
            {ratio != null ? (
              <p className="p80-live-preview-caption">Your prompt vs illustrative Torqa surface (estimated tokens)</p>
            ) : null}
            <div className="p70-bm-bars p80-live-preview-bars">
              <div className="p70-bm-row">
                <span>Your prompt</span>
                <div className="p70-bm-track">
                  <div className="p70-bm-fill p70-bm-fill-nl" style={{ width: `${nlPct}%` }} />
                </div>
                <span>{Math.round(pt)}</span>
              </div>
              <div className="p70-bm-row">
                <span>Template .tq</span>
                <div className="p70-bm-track">
                  <div className="p70-bm-fill p70-bm-fill-tq" style={{ width: `${tqPct}%` }} />
                </div>
                <span>{Math.round(tt)}</span>
              </div>
            </div>
            {preview.reduction_percent_vs_prompt != null ? (
              <p className="p80-live-preview-reduction">
                ~{preview.reduction_percent_vs_prompt.toFixed(1)}% fewer tokens in surface vs your prompt (est.)
              </p>
            ) : null}
            <p className="p80-live-preview-path">
              Template file: <code className="p80-code">{preview.template_relative_path}</code>
            </p>
            <div className="p80-results-preview-split">
              <div className="p80-results-preview-col">
                <div className="p80-results-preview-col-head">Your prompt (what you ran)</div>
                <pre className="p80-live-preview-nl" tabIndex={0}>
                  {(snapshotPrompt ?? demo).trim()}
                </pre>
              </div>
              <div className="p80-results-preview-col">
                <div className="p80-results-preview-col-head">Illustrative .tq surface</div>
                <pre className="p80-live-preview-tq" tabIndex={0}>
                  {preview.tq_source_preview.trimEnd()}
                </pre>
              </div>
            </div>
            <p className="p80-live-preview-disclaimer">{preview.disclaimer_en}</p>
          </div>
        </div>
      ) : null}
      <p className="p80-hero-demo-hint">
        Full pipeline: Desktop <strong>Build from prompt</strong> · CLI{" "}
        <code className="p80-code">torqa quick &quot;...&quot;</code> (needs <code className="p80-code">OPENAI_API_KEY</code>)
      </p>
    </div>
  );
}

const SLIDE_STORY = [
  {
    id: "problem",
    label: "Problem",
    title: "Intent dissolves in noise",
    body: (
      <>
        <p>
          Natural-language specs and one-off prompts grow without a contract: they burn tokens, rot after handoffs, and
          never face a real validator before someone calls them &quot;done.&quot;
        </p>
        <ul className="p83-slide-list">
          <li>Long briefs and chat transcripts are hard to review, diff, and automate.</li>
          <li>Generated previews without a gate ship wishful JSON — not a spec that tools can trust.</li>
          <li>CLI, desktop, and models drift apart because there is no single checkable surface.</li>
        </ul>
      </>
    ),
  },
  {
    id: "solution",
    label: "Solution",
    title: "A compact spec with a hard gate",
    body: (
      <>
        <p>
          TORQA is not another AI tool — it is a <strong>compression-first execution layer</strong>: the same intent in a small{" "}
          <code className="p80-code">.tq</code> surface, parse + full diagnostics, then materialize from one canonical IR.
        </p>
        <ul className="p83-slide-list">
          <li>
            <strong>Semantic compression</strong> — fewer tokens, sharper review, repeatable pipelines.
          </li>
          <li>
            <strong>Validation first</strong> — what fails never pretends to be shipped output.
          </li>
          <li>
            <strong>One core</strong> — CLI, desktop, and web APIs share the same rules.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "proof",
    label: "Proof",
    title: "Measured, not hand-wavy",
    body: (
      <>
        <p>
          Compression and gate behavior are exercised by checked-in benchmarks and demos — reproducible in your checkout.
        </p>
        <ul className="p83-slide-list">
          <li>
            <a className="p70-inline-link" href="#benchmark">
              Flagship compression
            </a>{" "}
            — NL task brief vs Torqa surface, deterministic token estimates; repo checklist{" "}
            <code className="p80-code">docs/EXECUTION_LAYER_PROOF.md</code>.
          </li>
          <li>Validation gate proof manifests expect explicit accept/reject outcomes (zero mismatch in CI runs).</li>
          <li>
            <a className="p70-inline-link" href="#try">
              Live demo
            </a>{" "}
            — try a prompt and see token bars plus an illustrative surface (local server).
          </li>
        </ul>
      </>
    ),
  },
] as const;

function ThreeSlideExplanation() {
  const [slide, setSlide] = useState(0);
  const n = SLIDE_STORY.length;
  const s = SLIDE_STORY[slide];

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setSlide((i) => Math.min(n - 1, i + 1));
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSlide((i) => Math.max(0, i - 1));
      }
      if (e.key === "Home") {
        e.preventDefault();
        setSlide(0);
      }
      if (e.key === "End") {
        e.preventDefault();
        setSlide(n - 1);
      }
    },
    [n],
  );

  return (
    <section className="p70-section p70-section-tint" id="story" aria-labelledby="p83-story-heading">
      <div className="p70-wrap">
        <h2 id="p83-story-heading">Three-slide story</h2>
        <p className="p70-sub">Problem, solution, proof — quick read before you dive into the live demo or desktop app.</p>
        <div
          className="p83-slide-deck"
          role="region"
          aria-roledescription="carousel"
          aria-label="Three part explanation: problem, solution, proof"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          <div className="p83-slide-tabs" role="tablist" aria-label="Story slides">
            {SLIDE_STORY.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`p83-tab-${item.id}`}
                aria-selected={slide === i}
                aria-controls={`p83-panel-${item.id}`}
                className={`p83-slide-tab${slide === i ? " p83-slide-tab--active" : ""}`}
                onClick={() => setSlide(i)}
              >
                <span className="p83-slide-tab-num">{i + 1}</span>
                {item.label}
              </button>
            ))}
          </div>
          <div
            className="p83-slide-panel"
            role="tabpanel"
            id={`p83-panel-${s.id}`}
            aria-labelledby={`p83-tab-${s.id}`}
          >
            <h3 className="p83-slide-panel-title">{s.title}</h3>
            <div className="p83-slide-panel-body">{s.body}</div>
          </div>
          <div className="p83-slide-footer">
            <button
              type="button"
              className="p70-btn"
              onClick={() => setSlide((i) => Math.max(0, i - 1))}
              disabled={slide <= 0}
            >
              Previous
            </button>
            <div className="p83-slide-dots" aria-hidden="true">
              {SLIDE_STORY.map((item, i) => (
                <span key={item.id} className={`p83-slide-dot${slide === i ? " p83-slide-dot--on" : ""}`} />
              ))}
            </div>
            <button
              type="button"
              className="p70-btn p70-btn-primary"
              onClick={() => setSlide((i) => Math.min(n - 1, i + 1))}
              disabled={slide >= n - 1}
            >
              Next
            </button>
          </div>
          <p className="p83-slide-hint">Tip: focus this card and use arrow keys to change slides.</p>
        </div>
      </div>
    </section>
  );
}

function ExecutionLayerPitch() {
  return (
    <section className="p70-section" id="position" aria-labelledby="p84-position-heading">
      <div className="p70-wrap">
        <h2 id="p84-position-heading">Not another AI tool</h2>
        <blockquote className="p84-position-quote">
          TORQA is not another AI tool — it is a <strong>compression-first execution layer</strong>: the same natural-language
          intent is held in a small validated <code className="p80-code">.tq</code> surface, checked by deterministic rules, then
          materialized into real artifacts.
        </blockquote>
        <p className="p70-sub">
          You still use <strong>GPT</strong>, <strong>Claude</strong>, or <strong>Gemini</strong> for drafts and chat. TORQA is
          where that intent becomes a contract the core can validate, diff, and ship — stable{" "}
          <strong>prompt → app → preview</strong> on one path.
        </p>
      </div>
    </section>
  );
}

function AssistantCompareGrid() {
  const rows = [
    {
      id: "gpt",
      title: "GPT vs TORQA",
      a: "ChatGPT and the OpenAI API excel at open-ended text; replies are stochastic and not a checkable spec on their own.",
      t: "Same NL task sits next to the validated .tq from one run: deterministic gate, token bars, optional API cost metrics.",
    },
    {
      id: "claude",
      title: "Claude vs TORQA",
      a: "Claude and IDE assistants are great for exploration; long threads are expensive to review and hard to automate.",
      t: "TORQA holds the compact surface that passed parse + semantics — repeatable in CLI, desktop, and demos.",
    },
    {
      id: "gemini",
      title: "Gemini vs TORQA",
      a: "Gemini-style flows shine at breadth; without a gate, generated previews stay wishful until someone validates them.",
      t: "Execution layer means invalid work never pretends to be shipped output; materialize runs only after the gate.",
    },
  ] as const;

  return (
    <section className="p70-section p70-section-tint" id="compare" aria-labelledby="p84-compare-heading">
      <div className="p70-wrap">
        <h2 id="p84-compare-heading">Same assistants. Different layer.</h2>
        <p className="p70-sub">
          We do not bundle three vendor APIs in one marketing click — we compare the <strong>same NL you would give any assistant</strong>{" "}
          to the <strong>TORQA surface and pipeline</strong> produced in one checkout or one Desktop session.
        </p>
        <div className="p84-compare-grid">
          {rows.map((row) => (
            <article key={row.id} className="p84-compare-card">
              <h3 className="p84-compare-card-title">{row.title}</h3>
              <p className="p84-compare-p">
                <span className="p84-compare-k">Assistant role</span> {row.a}
              </p>
              <p className="p84-compare-p p84-compare-p--torqa">
                <span className="p84-compare-k">TORQA execution layer</span> {row.t}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BenchmarkLive() {
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
        else setErr("Live figures appear when you preview this site through the local TORQA server.");
      } catch {
        if (!cancelled) setErr("Connect via the local server to load live benchmark figures.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    <div className="p70-bm-live">
      <h3 className="p70-bm-title">Compression at a glance</h3>
      <p className="p70-bm-lead">
        Flagship intent expressed as a long natural-language brief versus the same intent in a compact Torqa surface —
        estimated token scale, deterministic benchmark.
      </p>
      {err && !metrics ? <p className="p70-bm-note">{err}</p> : null}
      {metrics && task > 0 && tq > 0 ? (
        <>
          {ratio != null ? <div className="p70-bm-ratio">{ratio.toFixed(2)}×</div> : null}
          <p className="p70-bm-caption">Natural language vs Torqa surface</p>
          <div className="p70-bm-bars">
            <div className="p70-bm-row">
              <span>NL brief</span>
              <div className="p70-bm-track">
                <div className="p70-bm-fill p70-bm-fill-nl" style={{ width: `${nlPct}%` }} />
              </div>
              <span>{Math.round(task)}</span>
            </div>
            <div className="p70-bm-row">
              <span>Torqa</span>
              <div className="p70-bm-track">
                <div className="p70-bm-fill p70-bm-fill-tq" style={{ width: `${tqPct}%` }} />
              </div>
              <span>{Math.round(tq)}</span>
            </div>
          </div>
        </>
      ) : metrics ? (
        <p className="p70-bm-note">Figures incomplete.</p>
      ) : !err ? (
        <p className="p70-bm-note">Loading…</p>
      ) : null}
    </div>
  );
}

function BenchmarkProofPack() {
  return (
    <div className="p84-proof-pack" id="verify" aria-labelledby="p84-verify-heading">
      <h3 id="p84-verify-heading" className="p84-proof-pack-title">
        Token, cost, and a path you can repeat
      </h3>
      <p className="p84-proof-pack-lead">
        Compression is visible in the bars above; the desktop app adds optional OpenAI call counts, latency, and an estimated
        USD line next to the same natural-language brief versus the validated surface after <strong>Build from prompt</strong>{" "}
        (not invoice-grade pricing, but directionally useful).
      </p>
      <div className="p84-proof-grid">
        <div className="p84-proof-card">
          <h4 className="p84-proof-card-title">Tokens</h4>
          <p>
            Same deterministic estimator as the flagship benchmark. Use{" "}
            <a href="#try" className="p70-inline-link">
              Try live
            </a>{" "}
            for in-browser bars when this site is served from the local TORQA server.
          </p>
        </div>
        <div className="p84-proof-card">
          <h4 className="p84-proof-card-title">Cost signal</h4>
          <p>
            With <code className="p80-code">OPENAI_API_KEY</code> set, the desktop flow surfaces API metrics beside the gate
            so you can compare spend on generation runs, not only final file size.
          </p>
        </div>
        <div className="p84-proof-card">
          <h4 className="p84-proof-card-title">Repeat</h4>
          <p>
            Stable <strong>prompt → .tq → materialize → preview</strong> in CLI, desktop, and the in-repo preview helper — see{" "}
            <code className="p80-code">docs/EXECUTION_LAYER_PROOF.md</code> for a maintainer checklist.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <>
      <div className="p70-bg-grid" aria-hidden="true" />
      <header className="p70-header">
        <div className="p70-header-inner">
          <a className="p70-logo" href="#hero">
            <span className="p70-logo-mark">TQ</span>
            <span className="p70-logo-text">TORQA</span>
          </a>
          <nav className="p70-nav" aria-label="Primary">
            <a href="#story">3 slides</a>
            <a href="#position">Layer</a>
            <a href="#compare">Compare</a>
            <a href="#solve">Why</a>
            <a href="#ideas">Pillars</a>
            <a href="#demo">Journey</a>
            <a href="#benchmark">Proof</a>
            <a href="#how">Flow</a>
            <a href="#start">Developers</a>
            <a href="#try">Live demo</a>
            <a href="#product-video">Video</a>
            <a href="#desktop">Desktop</a>
          </nav>
          <div className="p70-header-cta">
            <button type="button" className="p70-btn p70-btn-ghost" onClick={toggle} aria-label="Toggle color theme">
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <a className="p70-btn p70-btn-primary" href="#desktop">
              Get the app
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="p70-hero" id="hero">
          <div className="p70-hero-glow" aria-hidden="true" />
          <div className="p70-wrap p70-hero-inner">
            <p className="p70-kicker">torqa.dev · specification product</p>
            <h1>Write less. Build more.</h1>
            <p className="p70-tagline">
              Describe intent once. TORQA generates a validated spec, materializes real output, and keeps CLI, desktop, and
              web on the same core — no hand-wavy prompts.
            </p>
            <p className="p70-position-line">
              <strong>Compression-first execution layer</strong> — not another chat product. Same NL you use with GPT, Claude, or
              Gemini; TORQA validates and ships the spec.
            </p>
            <p className="p70-lead">
              Built for teams who want <strong>semantic compression</strong> (say more with less), a <strong>hard gate</strong>{" "}
              that rejects bad specs early, and <strong>one source of truth</strong> that stays aligned across tools and AI
              assistance.
            </p>
            <HeroTryPrompt />
            <div className="p70-hero-cta">
              <a className="p70-btn p70-btn-primary p70-btn-lg" href="#desktop">
                Get the desktop app
              </a>
              <a className="p70-btn p70-btn-lg" href="#start">
                Developer docs
              </a>
            </div>
          </div>
        </section>

        <ThreeSlideExplanation />

        <ExecutionLayerPitch />

        <AssistantCompareGrid />

        <section className="p70-section" id="solve">
          <div className="p70-wrap">
            <h2>Problems TORQA was built for</h2>
            <p className="p70-sub">
              Most delivery pain is not “more code” — it is unclear intent, unmeasured prompts, and specs that never
              faced a real validator.
            </p>
            <div className="p70-grid3">
              <div className="p70-card p70-card-elevated">
                <span className="p70-card-icon" aria-hidden="true">
                  ◇
                </span>
                <h3>Token and attention debt</h3>
                <p>
                  Long natural-language briefs rot fast. A compact Torqa surface holds the same intent with less noise and
                  clearer review.
                </p>
              </div>
              <div className="p70-card p70-card-elevated">
                <span className="p70-card-icon" aria-hidden="true">
                  ◆
                </span>
                <h3>Outputs without a gate</h3>
                <p>
                  Generated previews should be the fruit of a validated model — not wishful JSON. Invalid work stops before
                  it becomes files.
                </p>
              </div>
              <div className="p70-card p70-card-elevated">
                <span className="p70-card-icon" aria-hidden="true">
                  ◈
                </span>
                <h3>Silent drift</h3>
                <p>
                  Structural and semantic phases run up front. You get an explicit pass or fail — not surprises in
                  production.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="p70-section p70-section-tint" id="ideas">
          <div className="p70-wrap">
            <h2>Three pillars</h2>
            <p className="p70-sub">How TORQA stays honest whether humans or models author the spec.</p>
            <div className="p70-grid3">
              <div className="p70-card">
                <h3>Semantic compression</h3>
                <p>Smallest faithful representation of intent — fewer tokens, sharper diffs, repeatable automation.</p>
              </div>
              <div className="p70-card">
                <h3>Validation gate</h3>
                <p>Parsing and validation are first-class. What fails never pretends to be “done.”</p>
              </div>
              <div className="p70-card">
                <h3>Projection</h3>
                <p>One canonical IR drives previews and artifacts across the surfaces you care about.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="p70-section" id="demo">
          <div className="p70-wrap">
            <h2>From idea to materialized output</h2>
            <p className="p70-sub">
              A flagship-shaped flow, expressed as a story — not a terminal session. The toolchain lives in your
              environment; this page is the narrative.
            </p>
            <div className="p82-quick-path">
              <h3 className="p82-quick-path-title">Under two minutes (desktop trial)</h3>
              <ol className="p82-quick-path-steps">
                <li>
                  <code className="p80-code">pip install -e .</code> and install{" "}
                  <a href="https://nodejs.org/" className="p70-inline-link">
                    Node.js
                  </a>{" "}
                  for preview.
                </li>
                <li>Set <code className="p80-code">OPENAI_API_KEY</code>, then run the desktop app (see below).</li>
                <li>Choose a folder, paste a prompt (or use the three examples on this page), click Build from prompt.</li>
                <li>Open preview when the app offers it — Activity shows each step if something fails.</li>
              </ol>
            </div>
            <div className="p70-journey">
              <div className="p70-journey-step">
                <span className="p70-journey-num">1</span>
                <div>
                  <h3>Natural-language brief</h3>
                  <p>
                    Product and engineering describe flows, guards, and outcomes in plain language — the kind of brief you
                    would hand to a senior engineer or a trusted model.
                  </p>
                </div>
              </div>
              <div className="p70-journey-connector" aria-hidden="true" />
              <div className="p70-journey-step">
                <span className="p70-journey-num">2</span>
                <div>
                  <h3>Torqa surface</h3>
                  <p>
                    That intent is captured in a compact, checkable spec: flows, requirements, and explicit results — ready
                    for validation and diff-friendly review.
                  </p>
                </div>
              </div>
              <div className="p70-journey-connector" aria-hidden="true" />
              <div className="p70-journey-step">
                <span className="p70-journey-num">3</span>
                <div>
                  <h3>Validated projection</h3>
                  <p>
                    After the gate passes, you get credible previews and artifacts — web experiences, data-shaped output,
                    and language stubs — aligned to the same IR.
                  </p>
                </div>
              </div>
            </div>
            <div className="p70-hero-cta p70-cta-row">
              <a className="p70-btn p70-btn-primary" href="#desktop">
                Try the desktop experience
              </a>
              <a className="p70-btn" href="#start">
                Developer onboarding
              </a>
            </div>
          </div>
        </section>

        <section className="p70-section" id="benchmark">
          <div className="p70-wrap">
            <h2>Measured compression</h2>
            <p className="p70-sub">
              The flagship benchmark compares the same intent as a long task brief versus a Torqa surface — so compression
              is visible, not hand-wavy.
            </p>
            <BenchmarkLive />
            <BenchmarkProofPack />
          </div>
        </section>

        <section className="p70-section p70-section-tint" id="how">
          <div className="p70-wrap">
            <h2>How the pipeline feels</h2>
            <p className="p70-sub">One shape from authoring to artifacts — CLI, desktop, or automation, same core.</p>
            <div className="p70-flow">
              <span className="p70-flow-step">Author</span>
              <span className="p70-flow-glyph">→</span>
              <span className="p70-flow-step accent">Torqa spec</span>
              <span className="p70-flow-glyph">→</span>
              <span className="p70-flow-step">Validate</span>
              <span className="p70-flow-glyph">→</span>
              <span className="p70-flow-step">Project</span>
              <span className="p70-flow-glyph">→</span>
              <span className="p70-flow-step">Artifacts</span>
            </div>
          </div>
        </section>

        <section className="p70-section" id="start">
          <div className="p70-wrap">
            <h2>For developers</h2>
            <p className="p70-sub">
              TORQA ships as an open codebase: install from the repository, run the bundled demos, and read the in-repo
              documentation for every command and contract.
            </p>
            <div className="p70-grid3">
              <div className="p70-card p70-card-elevated">
                <h3>Install</h3>
                <p>Python 3.10+ and an editable install from the repo root; optional Node setup for the desktop shell.</p>
                <p className="p70-card-foot">Full steps ship in the documentation bundle.</p>
              </div>
              <div className="p70-card p70-card-elevated">
                <h3>Demos</h3>
                <p>Verify flagship assets, run a sample build, and inspect compression and gate proof — all from the CLI.</p>
                <p className="p70-card-foot">The demo entrypoint prints the canonical path.</p>
              </div>
              <div className="p70-card p70-card-elevated">
                <h3>Desktop</h3>
                <p>Native app for folders and specs: open a workspace, load samples, validate and build with clear feedback.</p>
                <p className="p70-card-foot">
                  <a className="p70-inline-link" href="#desktop">
                    Desktop overview →
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="p70-section p70-section-tint" id="product-video">
          <div className="p70-wrap">
            <h2>Recorded walkthrough</h2>
            <p className="p70-sub">
              Placeholder until a published embed: record prompt → gate pass → preview (desktop or CLI), and cite the line from{" "}
              <a href="#position" className="p70-inline-link">
                Not another AI tool
              </a>
              . Until then, use{" "}
              <a href="#try" className="p70-inline-link">
                Try live
              </a>{" "}
              and{" "}
              <a href="#desktop" className="p70-inline-link">
                Desktop
              </a>{" "}
              for the same story. Checklist:{" "}
              <code className="p80-code">docs/EXECUTION_LAYER_PROOF.md</code>.
            </p>
            <div className="p80-video-placeholder" aria-hidden="true">
              <span>Product video — embed when ready</span>
            </div>
          </div>
        </section>

        <section className="p70-section" id="desktop">
          <div className="p70-wrap">
            <h2>Desktop</h2>
            <p className="p70-sub">
              Prompt-first product mode: <strong>Build from prompt</strong> runs generate → validate → materialize → Vite preview
              in one action. Advanced mode is plain <code>.tq</code> editing with the same core.
            </p>
            <div className="p70-card p70-card-wide p70-card-elevated">
              <h3>Run locally</h3>
              <p>
                Install desktop dependencies once, then launch the app from the same environment where TORQA is installed.
                First run offers guided samples so you are productive in minutes.
              </p>
            </div>
          </div>
        </section>

        <footer className="p70-footer">
          <div className="p70-wrap p70-footer-inner">
            <p className="p70-footer-brand">TORQA</p>
            <p className="p70-footer-copy">
              Open source. Run the local server only in trusted environments. Documentation ships with the repository.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
