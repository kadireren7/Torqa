import type { Metadata } from "next";
import Link from "next/link";
import { CopyBlock } from "./copy-block";

const githubUrl = "https://github.com/kadireren7/Torqa";
const mcpSetupUrl = `${githubUrl}/blob/main/docs/MCP_SERVER.md`;

export const metadata: Metadata = {
  title: "MCP Server setup",
  description: "Run the Torqa MCP server locally and connect it to Claude.",
};

const CLAUDE_CONFIG = `{
  "mcpServers": {
    "torqa": {
      "command": "npm",
      "args": ["run", "mcp:server"],
      "cwd": "/absolute/path/to/Torqa/dashboard"
    }
  }
}`;

const TOOLS: { name: string; description: string }[] = [
  { name: "torqa.discover_tools",              description: "Normalize an MCP config or tool list into a tool inventory." },
  { name: "torqa.create_workflow_from_prompt", description: "Turn a plain-English request into a structured workflow plan." },
  { name: "torqa.validate_workflow",           description: "Validate a plan — missing tools, approvals, risks." },
  { name: "torqa.export_workflow",             description: "Export torqa.workflow.v1 JSON or a Claude prompt." },
  { name: "torqa.list_workflow_templates",     description: "Browse starter templates for common automations." },
];

const EXAMPLE_PROMPTS = [
  "Use Torqa to create a workflow that reads urgent Gmail emails, notifies Slack, and drafts replies.",
  "Use Torqa to create a workflow that turns new GitHub billing issues into CRM tasks.",
  "Use Torqa to create a workflow that summarizes Notion meeting notes into a Google Sheet.",
];

export default function McpServerPage() {
  return (
    <div className="bg-background text-foreground">
      <header
        className="sticky top-0 z-20 flex h-14 items-center justify-between border-b px-5 backdrop-blur sm:px-10"
        style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--surface-0) 80%, transparent)" }}
      >
        <Link href="/" className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--fg-1)" }}>
          Torqa
        </Link>
        <nav className="flex items-center gap-5 text-[13px]" style={{ color: "var(--fg-3)" }}>
          <Link href="/builder" className="hover:opacity-80">Builder</Link>
          <a href={mcpSetupUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">Docs</a>
          <a href={githubUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">GitHub</a>
        </nav>
      </header>

      <main id="main-content" className="mx-auto max-w-[820px] px-5 py-12 sm:px-8 sm:py-16">
        <div className="space-y-10">
          <div className="space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
              Setup
            </p>
            <h1 className="text-[32px] font-bold tracking-[-0.02em] sm:text-[40px]" style={{ color: "var(--fg-1)" }}>
              Run Torqa locally
            </h1>
            <p className="max-w-[640px] text-[15px] leading-[1.65]" style={{ color: "var(--fg-3)" }}>
              Torqa is a local stdio MCP server. Run it on your machine, point Claude at it,
              and Claude will be able to plan structured workflows on your behalf.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>1. Clone &amp; start the server</h2>
            <CopyBlock value={`git clone https://github.com/kadireren7/Torqa.git\ncd Torqa/dashboard\nnpm install\nnpm run mcp:server`} />
          </section>

          <section className="space-y-3">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>2. Add to Claude Desktop</h2>
            <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
              Open <span className="font-mono">claude_desktop_config.json</span>, paste the entry below,
              replace the path, and restart Claude.
            </p>
            <CopyBlock value={CLAUDE_CONFIG} />
          </section>

          <section className="space-y-3">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>3. Ask Claude</h2>
            <ul className="space-y-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <li
                  key={p}
                  className="rounded-lg px-4 py-3 text-[13px]"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--line)", color: "var(--fg-2)" }}
                >
                  “{p}”
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>Available MCP tools</h2>
            <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
              <table className="w-full text-[13px]">
                <tbody>
                  {TOOLS.map((t, i) => (
                    <tr
                      key={t.name}
                      style={{
                        borderTop: i === 0 ? undefined : "1px solid var(--line)",
                        background: "var(--surface-1)",
                      }}
                    >
                      <td className="px-4 py-3 align-top font-mono text-[12px]" style={{ color: "var(--accent)" }}>
                        {t.name}
                      </td>
                      <td className="px-4 py-3 align-top" style={{ color: "var(--fg-3)" }}>
                        {t.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>Limitations today</h2>
            <ul className="space-y-1.5 text-[13px]" style={{ color: "var(--fg-3)" }}>
              <li>— Planning only. Torqa does not execute Gmail, Slack, Stripe, etc.</li>
              <li>— No OAuth or live MCP introspection.</li>
              <li>— stdio transport only — designed for local Claude clients.</li>
            </ul>
          </section>

          <section className="flex flex-wrap items-center gap-3 rounded-xl px-5 py-4"
            style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
          >
            <Link
              href="/builder"
              className="rounded-lg px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Open web builder
            </Link>
            <a
              href={mcpSetupUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-80"
              style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
            >
              Full setup docs
            </a>
          </section>
        </div>
      </main>
    </div>
  );
}
