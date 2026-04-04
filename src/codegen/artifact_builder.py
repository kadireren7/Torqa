from __future__ import annotations

import json
import re
from html import escape as html_escape
from typing import Any, Dict, List, Sequence, Tuple

from src.ir.canonical_ir import IRGoal
from src.projection.projection_strategy import ProjectionPlan, ProjectionTarget
from src.projection.stub_paths_layout import effective_stub_paths_for_goal
from src.projection.extra_artifacts import merge_extra_projection_artifacts
from src.codegen.ir_to_projection import (
    ir_goal_cpp_projection,
    ir_goal_go_projection,
    ir_goal_kotlin_projection,
    ir_goal_python_projection,
    ir_goal_rust_projection,
    ir_goal_server_typescript_stub,
    ir_goal_sql_projection,
    ir_goal_typescript_index_projection,
)


WEBSITE_GENERATION_PROFILE: Dict[str, bool] = {
    "supports_pages": True,
    "supports_components": True,
    "supports_forms": True,
    "supports_basic_layout": True,
    "supports_previewable_structure": True,
}


def _humanize_field(name: str) -> str:
    s = re.sub(r"[_\-]+", " ", name.strip())
    if not s:
        return name
    return s[0].upper() + s[1:] if len(s) == 1 else s[0].upper() + s[1:]


def infer_ui_profile(goal_text: str) -> str:
    """
    Map flow goal wording to a UI shell (P81). IR ``goal`` string is the signal — not raw NL prompt.
    """
    t = (goal_text or "").lower()
    if any(k in t for k in ("dashboard", "admin", "analytics", "metrics")):
        return "dashboard"
    if any(k in t for k in ("startup", "saas", "growth")):
        return "startup"
    if any(k in t for k in ("modern", "minimal", "clean", "sleek")):
        return "modern"
    return "default"


def _derive_brand_name(goal_title: str) -> str:
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", goal_title or "Product").strip()
    parts = [p for p in s.replace("_", " ").split() if p]
    if not parts:
        return "Product"
    return parts[0][0].upper() + parts[0][1:] if len(parts[0]) > 1 else parts[0].upper()


def _landing_headline(goal: IRGoal) -> str:
    g = (goal.goal or "this flow").replace("_", " ")
    return f"Design and ship {g} without layout guesswork"


def _landing_subcopy(goal: IRGoal) -> str:
    if goal.inputs:
        labels = ", ".join(_humanize_field(i.name) for i in goal.inputs[:4])
        extra = " and more" if len(goal.inputs) > 4 else ""
        return (
            f"This preview lines up your TORQA spec with a real screen structure. "
            f"The sign-in path collects {labels}{extra} — swap in your API when you are ready to ship."
        )
    return (
        "A focused preview generated from your validated TORQA intent: clear sections, responsive layout, "
        "and room to wire a backend without redoing the shell."
    )


def _feature_cards(goal: IRGoal) -> List[Dict[str, str]]:
    cards: List[Dict[str, str]] = []
    for inp in goal.inputs[:3]:
        hn = _humanize_field(inp.name)
        cards.append(
            {
                "title": f"{hn} captured cleanly",
                "body": (
                    f"A dedicated control for {hn.lower()} with labels and spacing tuned for forms — "
                    f"ready to attach validation and API calls."
                ),
            }
        )
    if goal.result and len(cards) < 3:
        cards.append(
            {
                "title": "Success state is explicit",
                "body": (
                    f"When the flow completes, the experience resolves to “{goal.result}” — "
                    f"mirrored here so stakeholders see the same story as your spec."
                ),
            }
        )
    fallbacks = [
        {
            "title": "Responsive by default",
            "body": "Narrow phones and wide desktops both get a usable grid; breakpoints follow common product patterns.",
        },
        {
            "title": "Semantic structure",
            "body": "Landmarks, headings, and form labels are wired for accessibility and easier automated testing.",
        },
        {
            "title": "Iterate from intent",
            "body": "Regenerate after `.tq` changes — keep the product narrative and the UI scaffold aligned.",
        },
    ]
    i = 0
    while len(cards) < 3:
        cards.append(fallbacks[i % len(fallbacks)])
        i += 1
    return cards[:3]


# P21 + P81 — Vite + React + Tailwind under ``generated/webapp/``.
# P81: UI primitives (navbar, hero, cards, form fields), ``react-router-dom`` routes,
# profile from ``infer_ui_profile(goal.goal)``, production-style copy (no lorem).
WEBAPP_CORE_RELATIVE_PATHS: Tuple[str, ...] = (
    "generated/webapp/package.json",
    "generated/webapp/tsconfig.json",
    "generated/webapp/vite.config.ts",
    "generated/webapp/tailwind.config.js",
    "generated/webapp/postcss.config.js",
    "generated/webapp/index.html",
    "generated/webapp/README.md",
    "generated/webapp/src/main.tsx",
    "generated/webapp/src/App.tsx",
    "generated/webapp/src/uiProfile.ts",
    "generated/webapp/src/components/AppFooter.tsx",
    "generated/webapp/src/components/Button.tsx",
    "generated/webapp/src/components/Card.tsx",
    "generated/webapp/src/components/FormField.tsx",
    "generated/webapp/src/components/Hero.tsx",
    "generated/webapp/src/components/Navbar.tsx",
    "generated/webapp/src/pages/LandingPage.tsx",
    "generated/webapp/src/pages/LoginPage.tsx",
    "generated/webapp/src/pages/DashboardPage.tsx",
    "generated/webapp/src/styles.css",
    "generated/webapp/src/vite-env.d.ts",
)


def _build_app_tsx(flow_literal: str, flow_result_literal: str, brand_literal: str, profile_literal: str) -> str:
    """Inject JSON-safe string literals into App shell."""
    return f"""import {{ BrowserRouter, Routes, Route, Navigate }} from "react-router-dom";
import {{ Navbar }} from "./components/Navbar";
import {{ AppFooter }} from "./components/AppFooter";
import {{ LandingPage }} from "./pages/LandingPage";
import {{ LoginPage }} from "./pages/LoginPage";
import {{ DashboardPage }} from "./pages/DashboardPage";
import type {{ UiProfile }} from "./uiProfile";

export function App() {{
  const flowName = {flow_literal};
  const flowResult = {flow_result_literal};
  const brandName = {brand_literal};
  const uiProfile = {profile_literal} as UiProfile;

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-slate-50 antialiased">
        <Navbar brandName={{brandName}} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
          <Routes>
            <Route path="/" element={{<LandingPage flowName={{flowName}} />}} />
            <Route path="/login" element={{<LoginPage />}} />
            <Route
              path="/app"
              element={{<DashboardPage flowResult={{flowResult}} uiProfile={{uiProfile}} />}}
            />
            <Route path="*" element={{<Navigate to="/" replace />}} />
          </Routes>
        </main>
        <AppFooter />
      </div>
    </BrowserRouter>
  );
}}
"""


def _build_landing_page_tsx(goal: IRGoal, profile: str) -> str:
    hl = json.dumps(_landing_headline(goal))
    sub = json.dumps(_landing_subcopy(goal))
    prof = json.dumps(profile)
    cards = _feature_cards(goal)
    cards_jsx = "\n".join(
        f'          <Card title={json.dumps(c["title"])} description={json.dumps(c["body"])} />'
        for c in cards
    )
    return f"""import React from "react";
import {{ Card }} from "../components/Card";
import {{ Hero }} from "../components/Hero";
import type {{ UiProfile }} from "../uiProfile";

export function LandingPage({{ flowName }}: {{ flowName: string }}) {{
  const uiProfile = {prof} as UiProfile;
  return (
    <div className="space-y-14 pb-8">
      <Hero
        flowName={{flowName}}
        uiProfile={{uiProfile}}
        headline={hl}
        subline={sub}
      />
      <section className="space-y-6" aria-labelledby="value-title">
        <div className="max-w-2xl">
          <h2 id="value-title" className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Built from your spec, not filler copy
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Each block below ties back to fields and outcomes you declared — swap text anytime, keep the structure.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
{cards_jsx}
        </div>
      </section>
    </div>
  );
}}
"""


_LOGIN_PAGE_TEMPLATE = """import React from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";

export function LoginPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Preview-only form — connect your identity provider and API routes in your app layer.
        </p>
      </div>
      <Card title="Credentials" description="Use any values locally; nothing is sent to a server from this demo.">
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
__FORM_FIELDS__
          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" variant="primary">
              Continue
            </Button>
            <Link
              to="/"
              className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Back to overview
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
"""


def _build_login_page_tsx(form_fields: str) -> str:
    return _LOGIN_PAGE_TEMPLATE.replace("__FORM_FIELDS__", form_fields)


def _build_dashboard_page_tsx() -> str:
    return """import React from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import type { UiProfile } from "../uiProfile";

export function DashboardPage({
  flowResult,
  uiProfile,
}: {
  flowResult: string;
  uiProfile: UiProfile;
}) {
  const isDash = uiProfile === "dashboard";
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Workspace</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Post-login surface derived from your TORQA flow. Hook session, roles, and data sources where you need them.
          </p>
        </div>
        <Link
          to="/login"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Return to sign-in
        </Link>
      </div>
      <div
        className={
          isDash
            ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            : "grid gap-4 md:grid-cols-2"
        }
      >
        <Card
          title="Flow outcome"
          description={
            flowResult
              ? `Your spec resolves here as: “${flowResult}”.`
              : "No explicit result label in the spec — add one in `.tq` to anchor this screen."
          }
        >
          <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">
            {flowResult || "—"}
          </p>
        </Card>
        <Card
          title="Session readiness"
          description="Placeholder for auth state — wire cookies, tokens, or headers from your backend."
        >
          <p className="mt-3 text-sm font-medium text-amber-800">Preview mode</p>
        </Card>
        <Card
          title="Next actions"
          description="Typical next steps: load user profile, fetch entitlements, redirect if session is invalid."
        >
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
            <li>Validate session on mount</li>
            <li>Load account summary</li>
            <li>Surface primary CTA from your product</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
"""


_COMPONENT_APP_FOOTER = """import React from "react";

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white/80 py-6 text-center text-xs text-slate-500 backdrop-blur-sm">
      <p>
        Local preview from your TORQA flow — not connected to a live API. Run{" "}
        <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
          npm run dev
        </code>{" "}
        in this folder.
      </p>
    </footer>
  );
}
"""

_COMPONENT_BUTTON = """import React from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45";
  const variants: Record<Variant, string> = {
    primary:
      "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:ring-indigo-500",
    secondary:
      "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-400",
    ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400",
  };
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
"""

_COMPONENT_CARD = """import React from "react";

export function Card({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm shadow-slate-900/[0.04] ${className}`.trim()}
    >
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}
"""

_COMPONENT_FORM_FIELD = """import React from "react";

export function FormField({
  id,
  label,
  type = "text",
}: {
  id: string;
  label: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        autoComplete="off"
      />
    </div>
  );
}
"""

_COMPONENT_HERO = """import { Link } from "react-router-dom";
import type { UiProfile } from "../uiProfile";

export function Hero({
  flowName,
  uiProfile,
  headline,
  subline,
}: {
  flowName: string;
  uiProfile: UiProfile;
  headline: string;
  subline: string;
}) {
  const shells: Record<UiProfile, string> = {
    modern:
      "border-slate-200/80 bg-gradient-to-b from-white to-slate-50 shadow-sm shadow-slate-900/[0.04]",
    startup:
      "border-indigo-100 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-white shadow-xl shadow-indigo-900/25",
    dashboard:
      "border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-slate-100 shadow-xl shadow-slate-950/40",
    default:
      "border-slate-200/80 bg-gradient-to-b from-slate-50 to-white shadow-sm",
  };
  const titleStyle: Record<UiProfile, string> = {
    modern: "text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl",
    startup: "text-4xl font-black tracking-tight text-white sm:text-5xl",
    dashboard: "text-3xl font-bold tracking-tight text-white sm:text-4xl",
    default: "text-3xl font-bold text-slate-900 sm:text-4xl",
  };
  const subStyle: Record<UiProfile, string> = {
    modern: "mt-4 max-w-2xl text-base leading-relaxed text-slate-600",
    startup: "mt-4 max-w-xl text-base leading-relaxed text-indigo-100",
    dashboard: "mt-4 max-w-2xl text-sm leading-relaxed text-slate-400",
    default: "mt-4 max-w-2xl text-base leading-relaxed text-slate-600",
  };
  const kickerMuted =
    uiProfile === "startup" || uiProfile === "dashboard"
      ? "text-white/75"
      : "text-indigo-600";
  const ctaPrimary =
    uiProfile === "startup"
      ? "bg-white text-indigo-700 hover:bg-indigo-50"
      : uiProfile === "dashboard"
        ? "bg-indigo-500 text-white hover:bg-indigo-400"
        : "bg-indigo-600 text-white hover:bg-indigo-500";
  const ctaSecondary =
    uiProfile === "startup"
      ? "border-white/50 text-white hover:bg-white/10"
      : uiProfile === "dashboard"
        ? "border-slate-600 text-slate-200 hover:bg-slate-800"
        : "border-slate-300 bg-white/80 text-slate-800 hover:bg-white";

  return (
    <section
      className={`rounded-3xl border p-8 sm:p-10 lg:p-12 ${shells[uiProfile]}`}
      aria-labelledby="hero-heading"
    >
      <p className={`text-xs font-semibold uppercase tracking-wider ${kickerMuted}`}>{flowName}</p>
      <h1 id="hero-heading" className={`mt-2 ${titleStyle[uiProfile]}`}>
        {headline}
      </h1>
      <p className={subStyle[uiProfile]}>{subline}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/login"
          className={`inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition ${ctaPrimary}`}
        >
          Open sign-in
        </Link>
        <Link
          to="/app"
          className={`inline-flex rounded-lg border px-5 py-2.5 text-sm font-semibold transition ${ctaSecondary}`}
        >
          View workspace
        </Link>
      </div>
    </section>
  );
}
"""

_COMPONENT_NAVBAR = """import { NavLink } from "react-router-dom";

function linkClass({ isActive }: { isActive: boolean }) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-indigo-600 text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;
}

export function Navbar({ brandName }: { brandName: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <span className="text-lg font-bold tracking-tight text-slate-900">{brandName}</span>
        <nav className="flex flex-wrap gap-1" aria-label="Main">
          <NavLink to="/" className={linkClass} end>
            Overview
          </NavLink>
          <NavLink to="/login" className={linkClass}>
            Sign in
          </NavLink>
          <NavLink to="/app" className={linkClass}>
            Workspace
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
"""


def _all_targets(plan: ProjectionPlan) -> List[ProjectionTarget]:
    return [plan.primary_target] + list(plan.secondary_targets)


def _target_key(target: ProjectionTarget) -> Tuple[str, str]:
    return (target.language.lower(), target.purpose.lower())


def _website_candidate_targets(plan: ProjectionPlan) -> List[ProjectionTarget]:
    out: List[ProjectionTarget] = []
    for t in _all_targets(plan):
        if t.language.lower() == "typescript" and t.purpose.lower() == "frontend_surface":
            out.append(t)
    return out


def _fallback_website_target(goal: IRGoal) -> ProjectionTarget:
    reasons = [
        "Projection emits a minimal website-capable demo bundle under generated/webapp/.",
        "No explicit TypeScript frontend target selected by strategy; fallback website target enabled.",
    ]
    if len(goal.inputs) >= 3:
        reasons.append("Input interaction level is sufficient for simple form generation.")
    return ProjectionTarget(
        language="typescript",
        purpose="frontend_surface",
        confidence=0.51,
        reasons=reasons,
        constraints={"source": "v6_2_website_threshold_fallback"},
    )


def build_generation_plan(ir_goal: IRGoal, projection_plan: ProjectionPlan) -> Dict[str, Any]:
    website_targets = _website_candidate_targets(projection_plan)
    selected: List[ProjectionTarget] = list(_all_targets(projection_plan))
    if not website_targets:
        website_fallback = _fallback_website_target(ir_goal)
        selected.append(website_fallback)
        website_targets = [website_fallback]

    website_ready = bool(ir_goal.goal and ir_goal.result is not None and len(ir_goal.inputs) > 0)
    frontend_target = website_targets[0]
    website_files = list(WEBAPP_CORE_RELATIVE_PATHS)
    if len(ir_goal.transitions) > 0:
        website_files.append("generated/webapp/src/server_stub.ts")

    return {
        "selected_targets": [
            {
                "language": t.language,
                "purpose": t.purpose,
                "confidence": t.confidence,
                "reasons": list(t.reasons),
            }
            for t in selected
        ],
        "website_generation_profile": dict(WEBSITE_GENERATION_PROFILE),
        "website_generation_ready": website_ready,
        "file_set": {
            "website_project": website_files,
        },
        "dependencies": {
            "website_project": [
                "react",
                "react-dom",
                "react-router-dom",
                "typescript",
                "vite",
                "tailwindcss",
                "postcss",
                "autoprefixer",
                "@types/react",
                "@types/react-dom",
            ]
        },
        "artifact_ordering": [
            "project_config",
            "app_entry",
            "layout_and_pages",
            "style_layer",
            "optional_server_stub",
        ],
        "runtime_assumptions": {
            "node": ">=18",
            "package_manager": "npm",
            "browser_preview": True,
            "frontend_target": {
                "language": frontend_target.language,
                "purpose": frontend_target.purpose,
            },
        },
    }


def generate_stub_artifact(goal: IRGoal, target: ProjectionTarget) -> Dict[str, Any]:
    lang = target.language.lower()
    purpose = target.purpose
    paths = effective_stub_paths_for_goal(goal)
    if lang == "rust":
        content = ir_goal_rust_projection(goal)
        stub_key = "rust"
    elif lang == "python":
        content = ir_goal_python_projection(goal)
        stub_key = "python"
    elif lang == "sql":
        content = ir_goal_sql_projection(goal)
        stub_key = "sql"
    elif lang == "typescript":
        content = ir_goal_typescript_index_projection(goal)
        stub_key = "typescript"
    elif lang == "go":
        content = ir_goal_go_projection(goal)
        stub_key = "go"
    elif lang == "kotlin":
        content = ir_goal_kotlin_projection(goal)
        stub_key = "kotlin"
    else:
        content = ir_goal_cpp_projection(goal)
        stub_key = "cpp"
    fn = paths.get(stub_key) or paths.get("cpp", "generated/cpp/main.cpp")
    files = [(fn, content)]
    return {
        "target_language": lang,
        "purpose": purpose,
        "files": [{"filename": f, "content": c} for f, c in files],
    }


def _generate_website_artifact(goal: IRGoal, plan: Dict[str, Any]) -> Dict[str, Any]:
    goal_title = goal.goal or "Generated Website"
    page_names = [i.name for i in goal.inputs[:3]]
    form_fields = "\n".join(
        (
            "          <FormField\n"
            f"            id={json.dumps(n)}\n"
            f"            label={json.dumps(_humanize_field(n))}\n"
            f'            type={json.dumps("password" if n.lower() == "password" else "text")}\n'
            "          />"
        )
        for n in page_names
    ) or '          <FormField id="username" label="Username" type="text" />'
    has_transitions = len(goal.transitions) > 0
    flow_literal = json.dumps(goal_title)
    result_str = str(goal.result) if goal.result is not None else ""
    flow_result_literal = json.dumps(result_str)
    brand_literal = json.dumps(_derive_brand_name(goal_title))
    ui_profile = infer_ui_profile(goal_title)
    profile_literal = json.dumps(ui_profile)
    app_tsx = _build_app_tsx(flow_literal, flow_result_literal, brand_literal, profile_literal)
    landing_tsx = _build_landing_page_tsx(goal, ui_profile)
    login_tsx = _build_login_page_tsx(form_fields)
    dashboard_tsx = _build_dashboard_page_tsx()
    index_title = html_escape(goal_title)
    readme = (
        f"# {goal_title} — demo webapp\n\n"
        "This folder is produced by **TORQA** projection (Vite + React + Tailwind CSS). "
        "Use it as a local preview baseline; API and auth are not wired here.\n\n"
        "## Run locally\n\n"
        "```bash\n"
        "npm install\n"
        "npm run dev\n"
        "```\n\n"
        "Open the URL Vite prints (often http://localhost:5173).\n"
    )
    _ui_profile_ts = (
        'export type UiProfile = "modern" | "startup" | "dashboard" | "default";\n'
    )
    files: List[Tuple[str, str]] = [
        (
            "generated/webapp/package.json",
            """{
  "name": "generated-webapp",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "~5.6.3",
    "vite": "^5.4.8"
  }
}
""",
        ),
        (
            "generated/webapp/tsconfig.json",
            """{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
""",
        ),
        (
            "generated/webapp/vite.config.ts",
            """import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
""",
        ),
        (
            "generated/webapp/tailwind.config.js",
            """/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
""",
        ),
        (
            "generated/webapp/postcss.config.js",
            """module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
""",
        ),
        (
            "generated/webapp/index.html",
            f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{index_title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
""",
        ),
        (
            "generated/webapp/src/vite-env.d.ts",
            """/// <reference types="vite/client" />
""",
        ),
        (
            "generated/webapp/README.md",
            readme,
        ),
        (
            "generated/webapp/src/main.tsx",
            """import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
""",
        ),
        (
            "generated/webapp/src/uiProfile.ts",
            _ui_profile_ts,
        ),
        (
            "generated/webapp/src/App.tsx",
            app_tsx,
        ),
        (
            "generated/webapp/src/components/AppFooter.tsx",
            _COMPONENT_APP_FOOTER,
        ),
        (
            "generated/webapp/src/components/Button.tsx",
            _COMPONENT_BUTTON,
        ),
        (
            "generated/webapp/src/components/Card.tsx",
            _COMPONENT_CARD,
        ),
        (
            "generated/webapp/src/components/FormField.tsx",
            _COMPONENT_FORM_FIELD,
        ),
        (
            "generated/webapp/src/components/Hero.tsx",
            _COMPONENT_HERO,
        ),
        (
            "generated/webapp/src/components/Navbar.tsx",
            _COMPONENT_NAVBAR,
        ),
        (
            "generated/webapp/src/pages/LandingPage.tsx",
            landing_tsx,
        ),
        (
            "generated/webapp/src/pages/LoginPage.tsx",
            login_tsx,
        ),
        (
            "generated/webapp/src/pages/DashboardPage.tsx",
            dashboard_tsx,
        ),
        (
            "generated/webapp/src/styles.css",
            """@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    @apply scroll-smooth;
  }
  body {
    @apply m-0 min-h-screen antialiased text-slate-800;
  }
  #root {
    @apply min-h-screen;
  }
}
""",
        ),
    ]
    if has_transitions:
        files.append(
            (
                "generated/webapp/src/server_stub.ts",
                ir_goal_server_typescript_stub(goal),
            )
        )
    return {
        "target_language": "typescript",
        "purpose": "frontend_surface",
        "generation_profile": dict(plan.get("website_generation_profile", {})),
        "files": [{"filename": fn, "content": content} for fn, content in files],
    }


def validate_generated_artifacts(artifacts: Sequence[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    seen: set = set()
    has_entrypoint = False
    critical_empty: List[str] = []
    for idx, art in enumerate(artifacts):
        files = art.get("files")
        if not isinstance(files, list) or not files:
            errors.append(f"Artifact #{idx} has no files.")
            continue
        for f in files:
            fn = str(f.get("filename", "")).strip()
            content = f.get("content")
            if not fn:
                errors.append(f"Artifact #{idx} has file with missing filename.")
                continue
            if fn in seen:
                errors.append(f"Duplicate output filename detected: {fn}")
            seen.add(fn)
            if not isinstance(content, str):
                errors.append(f"File content must be string for: {fn}")
                continue
            if fn.endswith(("package.json", "tsconfig.json", "src/main.tsx", "src/App.tsx")) and not content.strip():
                critical_empty.append(fn)
            if fn.endswith("src/main.tsx"):
                has_entrypoint = True
    if not has_entrypoint:
        errors.append("Minimal website entrypoint missing: src/main.tsx")
    if critical_empty:
        errors.append(f"Critical files are empty: {sorted(critical_empty)}")
    return errors


def can_generate_simple_website(
    ir_goal: IRGoal, projection_plan: ProjectionPlan, artifacts: Sequence[Dict[str, Any]]
) -> Dict[str, Any]:
    _ = ir_goal
    reasons: List[str] = []
    missing_capabilities: List[str] = []
    has_frontend_target = any(
        t.language.lower() == "typescript" and t.purpose.lower() == "frontend_surface"
        for t in _all_targets(projection_plan)
    ) or any(a.get("purpose") == "frontend_surface" for a in artifacts)
    if not has_frontend_target:
        missing_capabilities.append("frontend_surface_projection")
        reasons.append("No TypeScript frontend_surface target available.")
    file_names = {
        str(f.get("filename", "")).strip()
        for a in artifacts
        for f in (a.get("files") or [])
    }
    required = {
        "generated/webapp/package.json",
        "generated/webapp/tsconfig.json",
        "generated/webapp/vite.config.ts",
        "generated/webapp/index.html",
        "generated/webapp/src/main.tsx",
        "generated/webapp/src/App.tsx",
    }
    missing_files = sorted(required - file_names)
    if missing_files:
        missing_capabilities.append("website_file_output")
        reasons.append(f"Missing required website files: {missing_files}")
    quality_errors = validate_generated_artifacts(artifacts)
    if quality_errors:
        missing_capabilities.append("artifact_quality")
        reasons.extend(quality_errors[:3])
    passed = (not missing_files) and has_frontend_target and (len(quality_errors) == 0)
    return {
        "passed": passed,
        "reasons": reasons if not passed else ["Simple website generation threshold passed."],
        "missing_capabilities": sorted(set(missing_capabilities)),
    }


def generate_all_artifacts(ir_goal: IRGoal, projection_plan: ProjectionPlan) -> List[Dict[str, Any]]:
    plan = build_generation_plan(ir_goal, projection_plan)
    artifacts: List[Dict[str, Any]] = [_generate_website_artifact(ir_goal, plan)]
    website_key = ("typescript", "frontend_surface")
    for t in _all_targets(projection_plan):
        if _target_key(t) == website_key:
            continue
        artifacts.append(generate_stub_artifact(ir_goal, t))
    return merge_extra_projection_artifacts(ir_goal, projection_plan, artifacts)
