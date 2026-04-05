/** English — P108 product site + P134 launch pages */
export const messagesEn: Record<string, string> = {
  "lang.switch": "Language",
  "lang.en": "EN",
  "lang.tr": "TR",

  "theme.toggle": "Toggle color theme",
  "theme.light": "Light",
  "theme.dark": "Dark",

  "nav.primary": "Primary navigation",
  "nav.home": "Home",
  "nav.product": "Product",
  "nav.why": "Why TORQA",
  "nav.try": "Try",
  "nav.quickstart": "2 min start",
  "nav.proof": "Proof",
  "nav.docs": "Docs",
  "nav.pricing": "Pricing",
  "nav.contact": "Contact",
  "nav.desktop": "Desktop",
  "nav.getApp": "Get the app",

  "hero.surfaceBadge": "Official product site — torqa.dev",
  "hero.kicker": "Semantic-first execution layer",
  "hero.h1": "Validated specs. Less noise. Real builds.",
  "hero.tagline":
    "Describe what you want in plain language — TORQA turns it into a checked specification and materialized output. One desktop app, one rules engine, shared with CLI and automation.",
  "hero.positionLead": "NL or `.tq` → validated IR → artifacts.",
  "hero.positionRest":
    "Compression-first: the Torqa surface carries the same intent in fewer tokens than a typical natural-language brief — so review, diff, and reuse cost less context.",
  "hero.publicNote":
    "The full generate → validate → build → preview loop runs on your machine in TORQA Desktop. This site explains the product and can run an optional browser preview when the TORQA host API is available.",
  "hero.devNote":
    "Local UI development: run this site with Vite on port 3000; run `torqa-console` on port 8000 so `/api` demo and benchmark calls resolve.",
  "hero.cta.desktop": "Get TORQA Desktop",
  "hero.cta.quickstart": "2-minute start",
  "hero.cta.try": "Try live preview",
  "hero.cta.secondaryHint": "Deep dives: Product, Proof, and Try — or scroll for the full story on Home.",

  "story.token.h2": "The token story",
  "story.token.p1":
    "Long prompts and chat logs are expensive to re-read, diff, and feed back into tools. TORQA’s surface is designed to preserve meaning while shrinking token footprint — so humans and models spend less context on the same intent.",
  "story.token.p2":
    "You can see illustrative compression on the Try page (live preview) and flagship-style bars on Proof when the benchmark API is reachable.",

  "story.validation.h2": "Validation before anything ships",
  "story.validation.p1":
    "Specs are checked against the same rules everywhere. Invalid bundles fail with diagnostics you can act on — not silent drift or surprise at build time.",
  "story.validation.p2":
    "That gate is what makes the pipeline trustworthy for trials: structure first, then projections and previews.",

  "audience.h2": "Who this is for",
  "audience.sub": "Teams that want structure without losing speed.",
  "audience.c1.h": "Builders shipping real software",
  "audience.c1.p": "You want codegen and previews grounded in a single validated model — not one-off prompts scattered across tools.",
  "audience.c2.h": "Teams using AI-assisted design",
  "audience.c2.p": "You need a durable spec layer between natural language and repos — reviewable, diffable, and machine-checkable.",
  "audience.c3.h": "Maintainers and integrators",
  "audience.c3.p": "You care that desktop, CLI, and automation agree — one engine, no duplicated semantics.",

  "usecases.h2": "Best use cases",
  "usecases.sub": "Where TORQA earns its place in the loop.",
  "usecases.u1.h": "Prompt-first greenfield features",
  "usecases.u1.p": "Start from a brief, tighten into `.tq`, validate, then materialize artifacts and open a preview when your stack allows.",
  "usecases.u2.h": "Spec review before implementation",
  "usecases.u2.p": "Share a compact Torqa surface instead of walls of prose — easier to approve, challenge, and version.",
  "usecases.u3.h": "Repeatable trials and demos",
  "usecases.u3.p": "Same flagship benchmarks and gate proofs every time — credible compression and validation story for stakeholders.",

  "home.bench.teaser": "Flagship-style benchmark snapshot",
  "home.bench.linkProof": "Full proof page",
  "home.bench.linkTry": "Interactive try page",

  "quickstart.h2": "Try TORQA in 2 minutes",
  "quickstart.sub": "Short path — full generate → validate → build runs in the desktop app, not in this browser tab.",
  "quickstart.li1": "Install TORQA from your repo (`pip install -e .`) and launch the desktop app (`torqa-desktop` or `cd desktop && npm run dev` — use the Electron window).",
  "quickstart.li2": "Choose a project folder, describe what you want in plain language, and tap Build.",
  "quickstart.li3": "Open preview when prompted (needs Node.js) and expand “compare prompt vs spec” to see token estimates.",
  "quickstart.cta": "Get the desktop app",
  "quickstart.aside": "No account required — runs on your machine with your API keys.",

  "steps.h2": "How to try it",
  "steps.sub": "One path. No checklist of commands on this page.",
  "steps.s1.h": "Open the desktop app",
  "steps.s1.p": "Pick your project folder when prompted.",
  "steps.s2.h": "Describe what you want",
  "steps.s2.p": "Plain language — the same kind of brief you’d give a teammate.",
  "steps.s3.h": "Build",
  "steps.s3.p": "The app generates a checked spec, materializes files, and can open a preview when your stack is ready.",

  "why.h2": "Why it matters",
  "why.sub": "Three ideas — no jargon wall.",
  "why.c1.h": "Fewer tokens, clearer intent",
  "why.c1.p":
    "Compact specs cost less context to review and reuse than endless prose or chat logs — without giving up meaning.",
  "why.c2.h": "Validation before output",
  "why.c2.p": "Bad specs fail fast with clear diagnostics. Nothing ships through the gate until it passes.",
  "why.c3.h": "Same product everywhere",
  "why.c3.p": "Desktop, CLI, and automation share one rules engine — no drift between tools.",

  "demo.region.aria": "Optional browser preview: try a prompt",
  "demo.title": "Optional: preview in the browser",
  "demo.sub": "Illustrative template and token bars when this site is served from the local TORQA server.",
  "demo.apiHint":
    "With Vite on localhost:3000, run `torqa-console` (or `python -m website.server`) on port 8000 in another terminal so `/api` requests are proxied correctly.",
  "demo.label.prompt": "Your prompt",
  "demo.aria.prompt": "Prompt for the optional preview",
  "demo.defaultPrompt": "A simple sign-in flow with username, password, and basic audit fields.",
  "demo.example": "Reset to example",
  "demo.err.empty": "Enter a prompt first.",
  "demo.err.request": "Preview request failed.",
  "demo.err.build": "Could not build preview.",
  "demo.err.server":
    "Could not reach the preview API. On localhost:3000, run torqa-console on port 8000, or use the built site served from the TORQA host.",
  "demo.btn.run": "Run preview",
  "demo.btn.running": "Running…",
  "demo.note.api": "Local preview API only",
  "demo.results.title": "Preview",
  "demo.results.placeholder": "Run the preview to see token comparison and a sample surface.",
  "demo.loading": "Building preview…",
  "demo.profile": "Profile: {intent}",
  "demo.caption.bars": "Your prompt vs sample Torqa surface (estimated tokens)",
  "demo.bar.yourPrompt": "Your prompt",
  "demo.bar.templateTq": "Sample surface",
  "demo.reduction": "~{pct}% fewer tokens in the sample surface vs your prompt (est.)",
  "demo.col.ran": "Your prompt",
  "demo.col.surface": "Sample surface",
  "demo.hint.desktop": "For the full generate → validate → build flow, use TORQA Desktop.",

  "bench.h2": "Measured compression",
  "bench.sub":
    "Flagship benchmark bars load when the API is available (same idea: fewer tokens in the Torqa surface).",

  "bm.caption": "Natural-language brief vs Torqa surface (est.)",
  "bm.row.nl": "NL brief",
  "bm.row.tq": "Torqa",
  "bm.err.preview": "Figures appear when the benchmark API is reachable (e.g. torqa-console on :8000 with this site on :3000).",
  "bm.err.connect": "Could not load benchmark figures.",
  "bm.incomplete": "Figures incomplete.",
  "bm.loading": "Loading…",

  "desktop.h2": "TORQA Desktop",
  "desktop.sub": "The product path is prompt-first: describe, build, preview — with an advanced mode for editing `.tq` directly.",
  "desktop.body":
    "Install from the repository you already use for TORQA. The desktop app is the recommended way to run the full pipeline.",
  "desktop.install.h": "Install (minimal)",
  "desktop.install.li1": "Clone the TORQA repo and run `python -m pip install -e .` at the repo root (Python 3.10+).",
  "desktop.install.li2":
    "Windows: run the TORQA Desktop setup `.exe` from your distributor, or from `desktop/` run `npm install` then `npm run pack:win` to build the installer.",
  "desktop.install.li3": "Launch TORQA Desktop (Start menu or `torqa-desktop` from a dev checkout). Pick a folder, enter a prompt, tap Build.",
  "desktop.install.li4": "Add API keys in the app or via environment variables (`OPENAI_API_KEY`, etc.). See repo `desktop/README.md` and `docs/P133_DESKTOP_DISTRIBUTION.md`.",
  "desktop.cta": "Open the Try page",
  "desktop.pointer": "Short native-app pointer page",

  "lp.product.h1": "Product",
  "lp.product.lead":
    "TORQA is a compression-first execution layer: natural language or `.tq` sources become validated intermediate representation, then projections and materialized artifacts.",
  "lp.product.p1":
    "The desktop app is the primary authoring surface — folder picker, prompt or advanced `.tq` editing, validate, build, benchmark, and preview when your environment supports it.",
  "lp.product.p2":
    "The website you are reading is marketing and proof only. It is not an IDE and does not replace the desktop loop.",
  "lp.product.linkTry": "Go to Try",
  "lp.product.linkProof": "See Proof",

  "lp.proof.h1": "Proof",
  "lp.proof.lead":
    "Credibility comes from measurable compression and a hard validation gate. The blocks below use the same public benchmark JSON the flagship demo uses — when the host API is available.",
  "lp.proof.note": "For methodology and fixtures, see the repository docs: `docs/BENCHMARK_FLAGSHIP.md`, `docs/VALIDATION_GATE.md`.",

  "p136.site.title": "Honest comparison story (GPT · Claude · Gemini vs TORQA)",
  "p136.site.badgeRef": "Reference data",
  "p136.site.lead":
    "Offline benchmarks only — same estimator as the repo, illustrative USD tiers. Live retries, success, and quality scores are not in this file; they appear in TORQA Desktop after a real run.",
  "p136.site.loading": "Loading comparison summary…",
  "p136.site.flagship": "Flagship web shell",
  "p136.site.tokenProof": "Workflow & automation token proof",
  "p136.site.ratio": "NL ÷ TORQA",
  "p136.site.taskTok": "Task",
  "p136.site.tqTok": "TORQA surface",
  "p136.site.avgCompress": "Avg prompt ÷ TORQA",
  "p136.site.scenarios": "Scenarios passed",
  "p136.site.family.websites": "Websites",
  "p136.site.family.apps": "Apps",
  "p136.site.family.workflows": "Workflows",
  "p136.site.family.automations": "Automations",
  "p136.site.live": "Live API: see TORQA Desktop run summary / details — not aggregated here.",
  "p136.site.doc": "Full narrative: `docs/COMPARISON_REPORT.md` · regenerate: `torqa-comparison-report`",

  "lp.try.h1": "Try",
  "lp.try.lead": "Start in the desktop app; optionally run the browser preview below when the API is reachable.",

  "lp.docs.h1": "Documentation",
  "lp.docs.lead":
    "Authoritative guides ship in the TORQA repository. After `pip install -e .`, open these paths from your clone — they stay versioned with the code you run.",
  "lp.docs.try": "`docs/TRY_TORQA.md` — official surfaces and canonical trial path",
  "lp.docs.quick": "`docs/QUICKSTART.md` — install and first build",
  "lp.docs.limits": "`docs/KNOWN_LIMITS.md` — scope and trial boundaries",
  "lp.docs.desktop": "`docs/P133_DESKTOP_DISTRIBUTION.md` — Windows desktop packaging",
  "lp.docs.map": "`docs/DOC_MAP.md` — full documentation index",
  "lp.docs.comparison": "`docs/COMPARISON_REPORT.md` — P136 launch comparison (reference vs live, machine JSON)",
  "lp.docs.console":
    "Serving this site from the integrated host: run `torqa-console` and open the root URL it prints (built bundle under `/static/site/`). HTTP API explorer: `/api/openapi/docs`.",

  "lp.pricing.h1": "Pricing",
  "lp.pricing.lead": "TORQA core is open source. Commercial terms, hosted offerings, and enterprise packages are not listed on this page yet.",
  "lp.pricing.b1": "Early trials typically start from the public repository and desktop installer your team provides.",
  "lp.pricing.b2": "For packaging, evaluation agreements, or priority support, use the contact path below.",
  "lp.pricing.cta": "Contact",

  "lp.contact.h1": "Contact & feedback",
  "lp.contact.lead": "We keep this page minimal so you always know where messages should go.",
  "lp.contact.p1":
    "If you received TORQA through a trial or partner, use the channel they gave you (email, chat, or issue tracker) for product feedback and support.",
  "lp.contact.p2": "For the public source tree, technical discussion belongs next to that repository (issues or maintainer email), not on this marketing host.",
  "lp.contact.emailIntro": "If your deployment sets a public contact address at build time, it appears here:",
  "lp.contact.emailBtn": "Send email",

  "footer.brand": "TORQA",
  "footer.copy": "Open source. Use trusted environments for local previews.",
  "footer.nav": "Explore",
};
