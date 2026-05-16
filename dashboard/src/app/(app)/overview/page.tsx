import type { Metadata } from "next";
import Link from "next/link";
import { CopyBlock } from "../mcp-server/copy-block";

export const metadata: Metadata = {
  title: "Console",
  description: "Torqa MCP Workflow Agent — connect Claude or use the web builder to generate workflow plans.",
};

const STATUS = [
  { label: "MCP Server",      value: "Available locally" },
  { label: "Web Builder",     value: "Available" },
  { label: "Live Execution",  value: "Planned" },
  { label: "Hosted Credits",  value: "Planned" },
];

const SETUP = [
  { step: "01", title: "Run Torqa MCP server",        body: "cd dashboard && npm run mcp:server" },
  { step: "02", title: "Add Claude Desktop config",   body: "Drop the torqa entry into claude_desktop_config.json and restart Claude." },
  { step: "03", title: "Ask Claude to create a workflow", body: "Describe an automation in plain English. Torqa returns a structured plan." },
];

export default function ConsolePage() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-4)" }}>
          Console
        </p>
        <h1 className="text-[30px] font-bold tracking-[-0.02em]" style={{ color: "var(--fg-1)" }}>
          Torqa MCP Workflow Agent
        </h1>
        <p className="max-w-[680px] text-[14px] leading-[1.65]" style={{ color: "var(--fg-3)" }}>
          Use Torqa from Claude or the web console to generate structured MCP workflow plans.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATUS.map((s) => (
          <div
            key={s.label}
            className="rounded-xl px-4 py-4"
            style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
          >
            <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--fg-4)" }}>{s.label}</p>
            <p className="mt-1 text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>{s.value}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href="/demo/mcp-workflow-builder"
          className="rounded-lg px-5 py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Open web builder
        </Link>
        <Link
          href="/mcp-server"
          className="rounded-lg border px-5 py-2.5 text-[13px] font-medium transition-opacity hover:opacity-80"
          style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}
        >
          Read MCP setup
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>Run MCP server locally</h2>
        <CopyBlock value="cd dashboard && npm run mcp:server" />
      </section>

      <section className="space-y-4">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg-1)" }}>Claude setup</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {SETUP.map((s) => (
            <div
              key={s.step}
              className="rounded-xl p-5"
              style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
            >
              <p className="font-mono text-[11px] font-bold" style={{ color: "var(--accent)" }}>{s.step}</p>
              <p className="mt-2 text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>{s.title}</p>
              <p className="mt-2 text-[12.5px] leading-[1.6]" style={{ color: "var(--fg-3)" }}>{s.body}</p>
            </div>
          ))}
        </div>
        <p className="text-[12px]" style={{ color: "var(--fg-4)" }}>
          Full setup guide: <Link href="/mcp-server" className="underline">MCP Server</Link>
        </p>
      </section>
    </div>
  );
}
