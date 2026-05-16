import type { Metadata } from "next";
import Link from "next/link";
import { CopyBlock } from "./copy-block";

export const metadata: Metadata = {
  title: "MCP Server",
  description: "Connect Torqa to Claude as an MCP workflow server.",
};

const CLAUDE_CONFIG = `{
  "mcpServers": {
    "torqa": {
      "command": "npx",
      "args": ["tsx", "dashboard/src/mcp/server.ts"],
      "cwd": "/absolute/path/to/Project-X"
    }
  }
}`;

const TOOLS: { name: string; description: string }[] = [
  { name: "torqa.discover_tools", description: "List available MCP tools from a config or provided inventory." },
  { name: "torqa.create_workflow_from_prompt", description: "Turn a plain-English request into a structured workflow plan." },
  { name: "torqa.validate_workflow", description: "Validate a plan and surface missing tools, approvals, or risks." },
  { name: "torqa.export_workflow", description: "Export a plan as torqa.workflow.v1 JSON or a paste-ready Claude prompt." },
  { name: "torqa.list_workflow_templates", description: "Browse starter templates for common automations." },
];

const EXAMPLE_PROMPTS = [
  "Create a workflow that reads urgent Gmail emails and drafts replies.",
  "Create a workflow that turns GitHub billing issues into CRM tasks.",
  "Create a workflow that summarizes Notion meeting notes into Sheets.",
];

const LIMITS = [
  "Planning only — Torqa does not execute Gmail, Slack, Stripe, or any external API yet.",
  "No live OAuth connections. Tool inventories come from config or provided definitions.",
  "Local stdio transport. Spawn from Claude Desktop / Claude Code, not the browser.",
];

export default function McpServerPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
          Connect to Claude
        </p>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]" style={{ color: "var(--fg-1)" }}>
          Torqa MCP Server
        </h1>
        <p className="max-w-[640px] text-[14px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>
          Run the Torqa MCP server locally, connect it to Claude, and ask Claude to build
          workflows. The server uses stdio — its status is checked from your terminal, not the browser.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>1. Run the MCP server</h2>
        <CopyBlock value={`cd dashboard\nnpm install\nnpm run mcp:server`} />
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>2. Add to Claude Desktop config</h2>
        <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
          Open <span className="font-mono">claude_desktop_config.json</span> (Settings → Developer → Edit Config),
          add the entry below, and restart Claude.
        </p>
        <CopyBlock value={CLAUDE_CONFIG} />
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>3. Ask Claude to create a workflow</h2>
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
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>Available tools</h2>
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

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>Current limitations</h2>
        <ul className="space-y-1.5 text-[13px]" style={{ color: "var(--fg-3)" }}>
          {LIMITS.map((l) => (
            <li key={l}>— {l}</li>
          ))}
        </ul>
        <p className="text-[12px]" style={{ color: "var(--fg-4)" }}>
          Status is checked from your terminal, not the browser.
        </p>
      </section>

      <section
        className="flex flex-wrap items-center gap-3 rounded-xl px-5 py-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
      >
        <Link
          href="/demo/mcp-workflow-builder"
          className="rounded-lg px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Open web builder
        </Link>
        <a
          href="https://github.com/kadireren7/Torqa/blob/main/docs/MCP_SERVER.md"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-80"
          style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
        >
          Read full setup docs
        </a>
      </section>
    </div>
  );
}
