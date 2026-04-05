/** English UI strings — keys are stable API for `t()`. */
export const messagesEn: Record<string, string> = {
  "lang.switch": "Language",
  "lang.en": "EN",
  "lang.tr": "TR",

  "shell.missing.title": "Folder and .tq dialogs do not work in this view",
  "shell.missing.p1":
    "`torqaShell` did not load — you are probably in a browser (e.g. `http://localhost:5173`). File pickers only work in the Electron desktop window; browsers block the bridge for security.",
  "shell.missing.h2": "Do this",
  "shell.missing.li1":
    "Close this browser tab (if the address bar shows `http://`, that is the problem).",
  "shell.missing.li2.before": "PowerShell / Terminal:",
  "shell.missing.li3": "From repo root: `pip install -e .` then `torqa-desktop`",
  "shell.missing.li4":
    "If you use `npm run dev`: use the Electron desktop window that Electron opens (embedded preview lives there).",
  "shell.missing.foot":
    "In the correct window there is no address bar; you see the app menu and TORQA at the top.",

  "shell.bridge.error":
    "TORQA shell is unavailable — run the Electron desktop app (torqa-desktop or cd desktop && npm run start).",

  "brand": "TORQA",
  "theme.toggle": "Toggle color theme",

  "p131.home.lead":
    "TORQA turns a short description into a checked spec and real project files in the folder you choose.",
  "p131.home.promptLabel": "What do you want to build?",
  "p131.workspace.lead": "Your project saves in the folder shown in the title bar. Describe what you want, then tap Build.",
  "p131.dismiss": "Dismiss",
  "p131.dismiss.aria": "Dismiss hint",
  "p131.hint.welcomeHome":
    "Start by choosing a folder (TORQA will write files there). Then add a short description and tap Build.",
  "p131.hint.readyBuild": "When your prompt is ready, tap Build to generate the spec and materialize the project.",
  "p131.hint.tryPreview": "Use Start preview, Split view, or Open in browser to see the generated site when Node.js is available.",
  "p131.hint.tryCompare": "Open “Compare your prompt and the saved specification” below to see estimated token savings.",

  "home.prompt.placeholder": "Describe what you want to build…",
  "home.prompt.aria": "Build prompt",
  "home.chooseFolder": "Choose folder",
  "home.chooseFolder.title": "Select project folder",
  "home.build": "Build",
  "home.building": "Building…",
  "home.openProject": "Open existing project",
  "home.editor": "Editor",

  "title.openFolder": "Change project folder",
  "title.openTq": "Open a .tq file (Ctrl+O)",
  "title.openTqEllipsis": "Open .tq…",
  "title.save": "Save (Ctrl/Cmd+S)",
  "title.validateCore": "Validate current file via core",
  "title.genTqOnly": "Generate .tq only (no full build)",
  "title.openExisting": "Change project folder",
  "title.editor": "Edit files, validate, and build on disk",
  "title.toggleRight": "Toggle right panel",

  "status.validating": "Validating…",
  "status.building": "Building…",
  "status.benchmark": "Benchmark…",
  "status.generating": "Generating…",
  "status.pipeline": "Pipeline…",
  "status.pass": "PASS",
  "status.fail": "FAIL",
  "status.ready": "Ready",

  "btn.validate": "Validate",
  "btn.build": "Build",
  "btn.benchmark": "Benchmark",
  "btn.save": "Save",
  "btn.genTq": "Gen .tq",
  "btn.folder": "Folder…",

  "p117.group.aria": "Iterate on the current specification",
  "p117.improve": "Improve this app",
  "p117.addFeature": "Add feature",
  "p117.improve.title": "Refine the open .tq from your prompt; saves a new numbered edition (v2, v3, …).",
  "p117.addFeature.title": "Extend the open .tq with a new capability from your prompt; saves a new edition.",
  "p117.needTq": "Open a .tq file in the sidebar first (evolve uses the file on disk).",
  "p117.savedEdition": "Manifest edition v{edition} — {path}",

  "pipeline.pill.generating": "Generating",
  "pipeline.pill.validating": "Validating",
  "pipeline.pill.building": "Building",
  "pipeline.pill.launching": "Launching",

  "pipeline.busy.generate": "Turning your description into a structured plan…",
  "pipeline.busy.validate": "Checking that the plan is consistent…",
  "pipeline.busy.build": "Writing project files…",
  "pipeline.busy.preview": "Starting the preview…",
  "pipeline.busy.done": "Finishing up…",
  "pipeline.busy.working": "Working…",

  "failure.lead.gpt": "The AI step did not complete. Check your API key and connection, then try again.",
  "failure.lead.torqa": "We had a draft, but it did not pass our quality checks. Try a simpler description.",
  "failure.lead.setup":
    "Something was missing before we could start — for example the folder or an empty prompt.",
  "failure.lead.unknown": "Something went wrong. The list below may point to the next step.",

  "failure.axis.title": "What failed — GPT vs TORQA",
  "failure.axis.aria": "GPT versus TORQA failure context",
  "failure.axis.gpt.head": "GPT / OpenAI (non-deterministic)",
  "failure.axis.gpt.lede":
    "Typical failures: missing {openai}, HTTP 401/429/5xx, model JSON shape errors, or max repair retries while the verifier still rejects output.",
  "failure.axis.gpt.badge": "This run stopped here — the LLM path did not yield an accepted step.",
  "failure.axis.torqa.head": "TORQA (deterministic)",
  "failure.axis.torqa.lede":
    "Same checks every time: spec format, internal consistency, and file generation — independent of the model’s creativity.",
  "failure.axis.torqa.badge":
    "This run stopped here — GPT may have produced text, but TORQA did not pass the spec through its gates.",
  "failure.axis.setup.after":
    " — workspace or prompt was invalid before GPT or TORQA ran. Fix folder / text, then retry.",
  "failure.axis.setup.bold": "Setup",
  "failure.axis.unknownNote":
    "See details below. If the log mentions OpenAI or {pxai}, treat it as a {gpt} failure; if it mentions parse, TQ errors, or materialize, treat it as {torqa}.",
  "failure.axis.noteBold.gpt": "GPT",
  "failure.axis.noteBold.torqa": "TORQA",

  "pipeline.summary.generating": "Generating",
  "pipeline.summary.validating": "Validating",
  "pipeline.summary.building": "Building",
  "pipeline.summary.launching": "Launching",

  "human.none.result": "We could not read a clear result from the app.",
  "human.dash": "—",
  "human.gen.fail":
    "We could not draft an app plan from your prompt. This is often an API key or network issue.",
  "human.gen.ok": "Drafted a structured plan from your description.",
  "human.gen.wait": "—",
  "human.val.skip.draft": "Skipped because the draft step did not finish.",
  "human.val.fail.parse":
    "The draft did not pass our checks. Try simpler wording or fewer features at once.",
  "human.val.ok": "The plan looks consistent.",
  "human.val.wait": "—",
  "human.build.skip": "Skipped until earlier steps succeed.",
  "human.build.fail.write": "We could not write all project files. Open Details for suggestions.",
  "human.build.ok": "Project files were written to your folder.",
  "human.build.fail.generic": "The build step did not finish successfully.",
  "human.launch.skip": "—",
  "human.launch.ok.preview": "Preview is up — use the buttons above to open it.",
  "human.launch.ok.node":
    "Files are ready; automatic preview did not start (install Node.js to enable it).",
  "human.launch.skip.preview": "No automatic preview was started for this run.",

  "stack.title": "Your prompt and the saved specification",
  "stack.aria": "Prompt text versus saved specification",
  "stack.lede":
    "{left}: what you asked for in plain language. {right}: the checked specification file from the same run — the version that was allowed to generate your project.",
  "stack.leftBold": "Left",
  "stack.rightBold": "Right",
  "stack.col.plain": "Plain-language prompt",
  "stack.col.spec": "Saved specification",
  "stack.tokensEst": "~tokens (estimate)",
  "stack.vs": "vs",
  "stack.bar.prompt": "Prompt",
  "stack.bar.spec": "Specification",
  "stack.bar.reduction": "Reduction",
  "stack.noTokens": "Token estimates unavailable — compare the text below.",
  "stack.reductionLine":
    "Rough size vs prompt alone: about {pct}% smaller in the saved spec.",
  "stack.stats":
    "Length (characters): prompt {nl} · specification {tq}{ratio}",
  "stack.stats.ratio": " ({pct}% of prompt length)",
  "stack.out.prompt": "Your prompt",
  "stack.out.spec": "Saved specification",

  "tokenPanel.title": "Size comparison (estimates)",
  "tokenPanel.aria": "Estimated tokens: plain prompt {pt}, saved plan {tq}, reduction {r}",
  "tokenPanel.aria.ir": "Estimated tokens: IR JSON {pt}, TORQA surface {tq}, reduction {r}",
  "tokenPanel.aria.notReported": "not reported",
  "tokenPanel.label.plain": "Same idea in plain text",
  "tokenPanel.label.irJson": "Canonical IR JSON (est.)",
  "tokenPanel.label.spec": "Saved specification",
  "tokenPanel.label.smaller": "Smaller than plain text",
  "tokenPanel.emdash": "—",

  "tokenSavings.aria": "Token efficiency and estimated savings",
  "tokenSavings.title": "Token efficiency",
  "tokenSavings.badge.intent": "This run",
  "tokenSavings.badge.build": "Build (IR vs surface)",
  "tokenSavings.badge.estimate": "Estimator (not API usage)",
  "tokenSavings.stat.torqa": "TORQA surface",
  "tokenSavings.stat.reduction": "Reduction vs comparison",
  "tokenSavings.stat.ratio": "Compression ratio",
  "tokenSavings.bar.torqa": "TORQA surface",
  "tokenSavings.summary.nl": "TORQA used about {pct}% fewer tokens for this intent (estimated).",
  "tokenSavings.summary.nlNeutral": "Comparison ~{pt} tokens vs TORQA surface ~{tq} (estimated).",
  "tokenSavings.summary.ir":
    "This TORQA surface uses about {pct}% fewer estimated tokens than the canonical IR JSON for this build.",
  "tokenSavings.summary.irNeutral":
    "Compared to serializing the same intent as IR JSON, the surface is the compact execution layer (est.).",
  "tokenSavings.cost.title": "Estimated input cost reduction (illustrative)",
  "tokenSavings.cost.lead":
    "Uses an example input rate of ${rate} per 1M tokens on both sides — not a live quote or invoice.",
  "tokenSavings.cost.line":
    "~${hi} vs ~${lo} on the comparison axis; about ${save} less to carry the TORQA surface alone.",
  "tokenSavings.proof.line":
    "Checked-in workflow proof ({suite}): ~{pct}% average natural-language→TORQA reduction across {n} passing scenarios (utf8÷4 estimate).",
  "tokenSavings.proof.missing":
    "Open the repository root in this app to load reports/token_proof.json for the public benchmark summary.",
  "tokenSavings.estimator": "Deterministic estimator: {id}",

  "api.title": "AI usage (this run)",
  "api.liveBadge": "Live API",
  "api.honestNote":
    "Prompt/completion counts come from the provider response for this run. Estimated USD is only filled for OpenAI in this build; other vendors show usage without a rate here.",
  "api.aria": "AI usage for this run",
  "api.httpCalls": "HTTP calls",
  "api.retries": "Repair retries",
  "api.retries.hint": " (extra rounds after the first response)",
  "api.latency": "Total latency",
  "api.billable": "Billable tokens (API)",
  "api.billable.line": "in {inT} · out {outT} · total {totT}",
  "api.cost": "Est. cost",
  "api.cost.na": "— (no rate for this model)",
  "api.cost.usd": "~{usd} USD",
  "api.model": "Model",
  "api.provider": "Provider",

  "llm.aria": "Language model and API keys",
  "llm.sectionTitle": "AI model",
  "llm.vendorStrip": "OpenAI · Anthropic · Google",
  "llm.flowHint":
    "Pick the provider, optional model ids, and a generation preset. Parse, diagnostics, repair retries, and the quality floor stay the same across vendors; P129 tunes defaults per preset.",
  "llm.label": "Provider",
  "llm.gpt": "GPT (OpenAI)",
  "llm.claude": "Claude (Anthropic)",
  "llm.gemini": "Gemini (Google)",
  "llm.presenceTitle": "Key configured: OpenAI · Anthropic · Google (filled dot = yes)",
  "llm.key.openai": "OpenAI",
  "llm.key.anthropic": "Anthropic",
  "llm.key.google": "Google AI",
  "llm.showKeys": "API keys…",
  "llm.hideKeys": "Hide keys",
  "llm.keysHint":
    "Optional. Keys are encrypted with OS secure storage when available. You can also set OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY in your environment.",
  "llm.keyPlaceholder": "Paste key (saved only when you click Save)",
  "llm.clearSlot": "Clear stored key",
  "llm.saveKeys": "Save non-empty keys",
  "llm.saveUnavailable": "Key storage is not available in this view.",
  "llm.saveError": "Could not save: {error}",
  "llm.keysSaved": "API keys saved (only non-empty fields; encrypted when secure storage is available).",
  "llm.providerSaveError": "Could not save model preference: {error}",
  "llm.autoFixNoTq":
    "Auto-fix did not return a new .tq (check Output; add the API key for your selected model or set OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY).",
  "llm.appStarted":
    "Started: torqa app ({slot}) — {model} — generate → validate → materialize — profile: {profile}",
  "llm.generateTqStarted": "Generate .tq — {model} — profile: {profile}",
  "llm.fallbackUsed": "Primary model failed; this run finished using the OpenAI fallback.",
  "llm.sameProviderFallbackUsed": "Primary model failed; this run succeeded using your same-provider fallback model.",
  "llm.genMode": "Best mode",
  "llm.genMode.balanced": "Balanced (default)",
  "llm.genMode.cheapest": "Cheapest",
  "llm.genMode.fastest": "Fastest",
  "llm.genMode.highest_quality": "Highest quality",
  "llm.genMode.most_reliable": "Most reliable",
  "llm.modelId": "Model id",
  "llm.modelId.placeholder": "Empty = provider default",
  "llm.fallbackModelId": "Fallback model (same provider)",
  "llm.fallbackModelId.placeholder": "Optional — after primary exhausts retries",

  "p116.progressLine": "Generation step {phase}/{total} ({id}): {status}",
  "p116.rotate.0": "Multi-step generation: drafting base .tq…",
  "p116.rotate.1": "Multi-step generation: expanding structure…",
  "p116.rotate.2": "Multi-step generation: polishing layout & logic…",
  "p116.trace.title": "Generation passes",
  "p116.trace.aria": "Multi-phase .tq generation steps",
  "p116.traceSummary": "Multi-step generation complete: {summary}",

  "trial.fail.title": "Something went wrong",
  "trial.techDetails": "Technical details",
  "trial.engineDetails": "Details from the engine",
  "trial.whatToTry": "What to try",
  "trial.tryAgain": "Try again",
  "trial.retrying": "Retrying…",
  "trial.openSummary": "Open run summary",
  "trial.apiBeforeFail": "AI usage before the failure",

  "trial.success.title": "Ready",
  "trial.success.metricsIntro": "This run — usage and TORQA efficiency",
  "trial.compare.summary": "Compare your prompt and the saved specification",
  "trial.splitView": "Show split view",
  "trial.openBrowser": "Open in browser",
  "trial.retryPreview": "Retry preview",
  "trial.startPreview": "Start preview",
  "trial.previewFoot":
    "Preview did not start automatically. Install Node.js, then use Start preview, or run {npmI} and {npmDev} in {webapp}.",

  "p130.proof.aria": "Quality and reliability for this generation run",
  "p130.proof.title": "Quality and reliability (this run)",
  "p130.proof.quality": "Quality score (heuristic)",
  "p130.proof.partialValidity": "Partial attempt validity rate",
  "p130.proof.mode": "Generation mode",
  "p130.proof.models": "Primary / fallback model",
  "p130.proof.reliability": "Outcome",
  "p130.proof.firstPass": "First-pass success",
  "p130.proof.repaired": "Recovered after earlier attempts",
  "p130.proof.attemptsLine": "{n} LLM attempts in this run",
  "p130.trialLog.quality": "Quality score (heuristic): {score}/100",
  "p130.trialLog.partialValidity": "Partial attempt validity rate: {rate}",
  "p130.trialLog.repaired": "Reliability: succeeded after repair / retry passes",
  "p130.trialLog.firstPass": "Reliability: first-pass success",
  "p130.trialLog.profileMode": "Generation mode: {mode}",

  "fail.reliability.attempts": "{n} LLM attempts before this outcome — see Output or Activity for the full trace.",
  "fail.reliability.kinds": "Failure kinds seen (in order): {kinds}",

  "editor.noFile": "No file open",
  "editor.pickFile": " — pick a file from the list",
  "editor.modified": " · modified",
  "editor.toolbar.preview": "Preview",
  "editor.splitPreview": "Split preview",
  "editor.hidePreview": "Hide preview",
  "editor.reload": "Reload",
  "editor.browser": "Browser",
  "editor.coreConnected": "Core connected",
  "title.previewHide": "Hide embedded preview (full-width editor)",
  "title.previewSplit": "Show code + preview split",
  "title.reloadPreview": "Reload iframe",
  "title.browserPreview": "Open preview URL in the system browser",

  "insight.bench.emptyPara":
    "Run Benchmark for flagship-style compression on disk. For the public workflow token proof (five scenarios, validation-gated), see docs/TOKEN_PROOF.md and torqa-token-proof. If this panel stays empty, open the Output tab for stderr.",

  "diag.region.buildFailure": "Build failure details",
  "editor.preview.aria": "Preview",
  "editor.preview.titleHide": "Hide embedded preview (full-width editor)",
  "editor.preview.titleShow": "Show code + preview split",
  "editor.preview.reloadTitle": "Reload iframe",
  "editor.preview.browserTitle": "Open preview URL in the system browser",

  "preview.title": "Live preview",
  "preview.iframeTitle": "Generated webapp preview",

  "insight.tab.spec": "Spec detail",
  "insight.tab.bench": "Benchmark",
  "insight.tab.models": "Models",
  "insight.tab.feedback": "Feedback",
  "insight.bench.tokenNote":
    "Token estimates (flagship / P31 folder). Multi-scenario workflow proof (repo root): {doc} · {cmd} · {rep}. See Output for the exact command.",
  "insight.bench.empty":
    "Run {benchmark} for flagship-style compression on disk. For the public workflow token proof (five scenarios, validation-gated), see {doc} and {cmd}. If this panel stays empty, open the Output tab for stderr.",

  "modelCompare.badge.reference": "Reference estimate",
  "modelCompare.badge.live": "Live API result",
  "modelCompare.lead":
    "Offline reference only: compare TORQA against GPT-, Claude-, and Gemini-style prompt/code envelopes using averages from the repo’s token proof scenarios. No API keys required. This table is not a live generation from your prompt.",
  "modelCompare.p123.referenceOnly":
    "Everything above is computed from reports/token_proof.json — not from a model call you just made.",
  "modelCompare.empty":
    "Load the repository root (so reports/token_proof.json is readable) or regenerate the report with torqa-token-proof. This panel stays offline.",
  "modelCompare.table.aria": "Workflow comparison: TORQA versus LLM-style paths",
  "modelCompare.th.metric": "Metric",
  "modelCompare.th.torqa": "TORQA",
  "modelCompare.th.gpt": "GPT-style",
  "modelCompare.th.claude": "Claude-style",
  "modelCompare.th.gemini": "Gemini-style",
  "modelCompare.row.input": "Input tokens (est.)",
  "modelCompare.row.output": "Output tokens (est.)",
  "modelCompare.row.totalCost": "Total est. cost (USD)",
  "modelCompare.row.retries": "Retries",
  "modelCompare.row.inRedTorqa": "Input reduction vs TORQA",
  "modelCompare.row.costRedTorqa": "Cost reduction vs NL path",
  "modelCompare.retries.na": "— (not measured offline)",
  "modelCompare.cost.nl": "NL path",
  "modelCompare.cost.torqa": "TORQA path",
  "modelCompare.short.gpt": "GPT ref.",
  "modelCompare.short.claude": "Claude ref.",
  "modelCompare.short.gemini": "Gemini ref.",
  "modelCompare.note.suite": "Data: reports/token_proof.json · suite {id} · {n} passing scenarios averaged.",
  "modelCompare.note.estimator":
    "Tokens use the report’s deterministic estimator ({id}) — useful for relative size, not invoice-grade vendor counts.",
  "modelCompare.note.tokens":
    "NL-style columns use the same natural-language task size per scenario (TASK.md). TORQA uses the validated .tq surface size.",
  "modelCompare.note.llmOut":
    "LLM-style output size uses the benchmark’s BASELINE_CODE.txt token estimate (a fixed stub), not a live model generation.",
  "modelCompare.note.torqaOut":
    "TORQA output column uses IR bundle token estimates from the same report (expanded form vs surface).",
  "modelCompare.note.pricing":
    "Per-column $ uses example reference $/MTok for that vendor style (early 2026–style illustrative list tiers). Verify current rates with OpenAI, Anthropic, and Google.",
  "modelCompare.note.costRow":
    "Vendor cells stack NL-path and TORQA-path totals at that column’s reference prices so cost % is never mixed across vendors invisibly.",
  "modelCompare.advanced.summary": "Advanced: optional local keys (legacy)",
  "modelCompare.advanced.lead":
    "Real generations use the AI model picker above your prompt (encrypted when the OS supports it). The fields below duplicate localStorage only — they do not drive the main pipeline.",
  "modelCompare.p123.useMainKeys":
    "For actual runs, configure keys with “API keys…” next to the provider dropdown in the prompt area.",
  "modelCompare.live.notImplemented":
    "This build does not call external model APIs from the model comparison panel. Reference estimates above are unchanged.",
  "modelCompare.live.whereToSee":
    "When you run Build from prompt or Generate .tq, live provider usage (tokens, latency, model id, OpenAI-only cost estimate) appears in the run summary and Details tab under “AI usage (this run)”. That is separate from this offline reference table.",
  "modelCompare.key.openai": "OpenAI API key",
  "modelCompare.key.anthropic": "Anthropic API key",
  "modelCompare.key.google": "Google AI API key",
  "modelCompare.key.placeholder": "sk-… (stored locally only)",
  "modelCompare.key.warning":
    "Keys are saved in this app’s local storage on this device only. They are not sent anywhere in this version.",
  "modelCompare.key.save": "Save keys locally",
  "modelCompare.key.saved": "Saved",

  "p136.summary.title": "Launch comparison (P136)",
  "p136.summary.badgeRef": "Reference",
  "p136.summary.honestyShort":
    "Numbers below come from checked-in benchmarks only (no live API). USD is illustrative list-tier math. Retries, live success rate, and quality score appear after real runs in Summary / Details — not in this file.",
  "p136.summary.families": "Scenario families covered in the report",
  "p136.summary.flagship": "Flagship web shell",
  "p136.summary.tokenProof": "Token-proof suite",
  "p136.summary.ratio": "NL ÷ TORQA",
  "p136.summary.taskTok": "Task",
  "p136.summary.tqTok": "TORQA",
  "p136.summary.avgCompress": "Avg prompt ÷ TORQA",
  "p136.summary.scenarios": "Scenarios passed",
  "p136.summary.liveNote": "Live: use Build from prompt / Generate .tq — see AI usage and diagnostics for that run.",
  "p136.summary.doc": "Full comparison story: docs/COMPARISON_REPORT.md · reports/comparison_report.json",
  "p136.summary.empty": "Open the repository root so reports/comparison_report.json can load, then run torqa-comparison-report if missing.",
  "p136.family.websites": "Websites",
  "p136.family.apps": "Apps",
  "p136.family.workflows": "Workflows",
  "p136.family.automations": "Automations",
  "p136.family.company_operations": "Company operations",

  "bottom.runSummary": "Run summary",
  "bottom.output": "Output",
  "bottom.details": "Details",
  "bottom.activity": "Activity",
  "bottom.activity.title": "Timestamped log of what the app did",
  "bottom.lastRun": "Last run: {cmd}",

  "summary.intro": "Last run:",
  "summary.rawOutput": "Raw command output",
  "summary.techDetails": "Technical details",

  "output.empty": "Raw command output from the engine will appear here.",

  "activity.fail.title": "Last run — what went wrong",
  "activity.fail.area": "Area:",
  "activity.area.ai": "AI generation",
  "activity.area.checks": "Checks after generation",
  "activity.area.setup": "Before we started",
  "activity.area.unknown": "Unknown — see log",
  "activity.suggested": "Suggested fixes",
  "activity.buildFixes": "Build — suggested fixes",
  "activity.empty": "Activity fills in when you run {build}.",

  "diag.suggestedFixes": "Suggested fixes (from core)",
  "diag.details": "Details",
  "diag.tokenEstimates": "Token estimates",
  "diag.apiUsage": "AI usage — time, retries, cost",
  "diag.compare": "Prompt vs saved specification",
  "diag.generatedPaths": "Generated paths",

  "sidebar.empty.tq": "No {tq} files yet.",
  "sidebar.collapse": "Collapse file sidebar",
  "sidebar.expand": "Expand file sidebar",

  "banner.buildFail": "Build did not finish — try this",
  "banner.openDetails": "Open Details for more",

  "buildFailure.openOutput": "Open the Output tab for the raw log.",
  "buildFailure.pip": "From the repo root: pip install -e . — then restart the desktop app.",
  "buildFailure.editTq": "Edit the .tq file or narrow projection scope, then Build again.",
  "buildFailure.noJson": "Build failed (no JSON from core).",
  "buildFailure.generic": "Build did not succeed.",

  "fail.noJson": "TORQA did not return readable JSON (check Activity for the raw log).",
  "fail.fix.core": "Confirm the core is installed: in the repo root run pip install -e .",
  "fail.fix.apikey":
    "If this step was AI generation, set the API key for your selected model (or OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY) and restart the app.",
  "fail.stage": "Stage: {stage}",
  "fail.errors": "Errors:",
  "fail.issues": "Issues:",
  "fail.code": "Code: {code}",
  "fail.hint": "Hint: {hint}",
  "fail.fix.prompt": "Enter a short description of what you want, then run Build again.",
  "fail.fix.openaiEnv":
    "Set the right API key in your user environment (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, or use the in-app keys) and restart TORQA Desktop.",
  "fail.fix.network": "Check network access to your model provider.",
  "fail.fix.simplify":
    "Simplify the prompt (one main flow, named inputs), or add a concrete fix in a new line and run Build again.",
  "fail.fix.activity": "Review the Activity tab, tweak your prompt, and try again.",
  "fail.incomplete": "Build did not complete.",

  "diag.human.issues": "Issues:",
  "diag.human.warnings": "Warnings:",
  "diag.human.semErr": "Semantic errors:",
  "diag.human.semWarn": "Semantic warnings:",
  "diag.human.more": "… {n} more",

  "editor.empty.prompt": "Run Build above, or open Editor to work with files.",
  "editor.empty.advanced": "Select a {tq} file from the list.",

  "human.exception.fix1": "Restart TORQA Desktop.",
  "human.exception.fix2": "If this repeats, copy Activity log and report an issue.",
  "human.exception.line1": "Unexpected error while running the pipeline.",

  "cmd.last.benchmarkAuto": "benchmark (auto: P31 dir or flagship)",
  "cmd.last.benchmarkDemo": "torqa --json demo benchmark",

  "output.noJsonSurface": "(no JSON from core — see Output tab)",
  "output.noJsonBuild": "(no JSON from core)",
  "output.noJsonApp": "(no JSON)",

  "save.fail.line": "Could not save {name}: {error}",
  "save.fail.fix": "Check workspace folder permissions or pick another project folder.",

  "prompt.section.aria": "Build from prompt",
  "pipeline.steps.aria": "Build steps",

  "banner.buildFail.aria": "Build suggested fixes",

  "editor.resizeSplit": "Resize editor and preview",

  "bench.row.nlTask": "NL task (est.)",
  "bench.row.tqSurface": ".tq surface (est.)",
  "bench.row.irBundle": "IR bundle (est.)",
  "bench.row.generated": "Generated (est.)",

  "diag.moreFiles": "... {n} more",

  "insight.empty.before": "Run",
  "insight.empty.after": "on a specification file to load technical detail from the core.",

  "summary.empty.after": "to see a step-by-step summary here.",
  "summary.empty.hint": "Run Build above to see a step-by-step summary here.",
  "activity.empty.line": "Activity fills in when you run Build.",

  "diag.empty.before": "No technical details yet. Run ",
  "diag.empty.after": " or ",
  "diag.empty.end": ".",

  "trial.preview.npmI": "npm install",
  "trial.preview.npmDev": "npm run dev",
  "trial.preview.webapp": "generated/webapp",

  "p135.feedback.summary": "Trial feedback & local analytics",
  "p135.feedback.privacy":
    "TORQA Desktop records minimal session events on this device only (build attempts, preview/comparison usage, retries). Nothing is sent over the network automatically. You can leave optional feedback below — it is saved as a JSON file you can share with your trial contact.",
  "p135.feedback.pathsLabel": "Data folder:",
  "p135.feedback.eventsLabel": "Session event log (append-only):",
  "p135.feedback.feedbackDirLabel": "Saved feedback files:",
  "p135.feedback.docHint": "Review: docs/P135_TRIAL_FEEDBACK.md in the TORQA repository.",
  "p135.feedback.usefulQ": "Was this useful?",
  "p135.feedback.usefulYes": "Yes",
  "p135.feedback.usefulNo": "Not really",
  "p135.feedback.usefulSkip": "Skip",
  "p135.feedback.failedQ": "What failed? (optional)",
  "p135.feedback.fail.none": "Nothing / not applicable",
  "p135.feedback.fail.build": "Build / materialize",
  "p135.feedback.fail.validation": "Validation / surface",
  "p135.feedback.fail.preview": "Preview",
  "p135.feedback.fail.generation": "Generation / LLM",
  "p135.feedback.fail.other": "Other",
  "p135.feedback.commentLabel": "Anything else? (optional)",
  "p135.feedback.commentPh": "Short notes — no secrets or API keys.",
  "p135.feedback.save": "Save feedback to file",
  "p135.feedback.saving": "Saving…",
  "p135.feedback.saved": "Saved: {path}",
  "p135.feedback.err.bridge": "Feedback save needs the Electron desktop app.",
};
