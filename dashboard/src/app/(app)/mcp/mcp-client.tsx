"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Check, Copy, Cpu, Key, Plug, Shield, Terminal, Workflow, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: EASE, delay: i * 0.06 },
  }),
};

function CodeBlock({ code, lang = "json" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div
      className="relative rounded-xl overflow-hidden font-mono text-xs"
      style={{ background: "var(--surface-0)", border: "1px solid var(--line-2)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: "1px solid var(--line)", background: "var(--overlay-sm)" }}
      >
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--fg-4)" }}>
          {lang}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors hover:opacity-70"
          style={{ color: "var(--fg-3)" }}
        >
          {copied ? <Check className="h-3 w-3" style={{ color: "var(--emerald)" }} /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[12px] leading-relaxed" style={{ color: "var(--fg-2)" }}>
        {code}
      </pre>
    </div>
  );
}

const MCP_TOOLS = [
  {
    name: "torqa_scan",
    icon: Shield,
    desc: "Scan a workflow JSON against Torqa's policy engine. Returns trust score, findings, and governance decision.",
    params: `{ "workflow": {...}, "source": "n8n|github|generic", "policy": "torqa-baseline" }`,
  },
  {
    name: "torqa_policy_check",
    icon: Zap,
    desc: "Evaluate a single agent event against runtime policies in real time. Returns allow/block/review decision.",
    params: `{ "agent_id": "my-agent", "event_type": "tool_call", "payload": {...} }`,
  },
  {
    name: "torqa_get_findings",
    icon: Terminal,
    desc: "Retrieve findings from a previous scan by scan ID. Filter by severity, rule, or source.",
    params: `{ "scan_id": "uuid", "severity": "high|critical" }`,
  },
  {
    name: "torqa_accept_risk",
    icon: Workflow,
    desc: "Accept a risk finding with a justification note, creating an audit record.",
    params: `{ "scan_id": "uuid", "finding_signature": "...", "rationale": "..." }`,
  },
];

const CLAUDE_MCP_CONFIG = `{
  "mcpServers": {
    "torqa": {
      "command": "npx",
      "args": ["-y", "@torqa/mcp-server"],
      "env": {
        "TORQA_API_KEY": "<your-api-key>",
        "TORQA_BASE_URL": "https://your-torqa-instance.com"
      }
    }
  }
}`;

const CLAUDE_DESKTOP_CONFIG = `// ~/.claude/settings.json  (Claude Desktop)
{
  "mcpServers": {
    "torqa": {
      "command": "npx",
      "args": ["-y", "@torqa/mcp-server@latest"],
      "env": {
        "TORQA_API_KEY": "tq_live_xxxxxxxxxxxx",
        "TORQA_BASE_URL": "https://your-torqa-instance.com"
      }
    }
  }
}`;

const CLAUDE_CODE_CONFIG = `# .claude/mcp.json  (Claude Code project-level)
{
  "mcpServers": {
    "torqa": {
      "command": "npx",
      "args": ["-y", "@torqa/mcp-server@latest"],
      "env": {
        "TORQA_API_KEY": "tq_live_xxxxxxxxxxxx"
      }
    }
  }
}`;

const EXAMPLE_PROMPT = `# Example: Ask Claude to govern your n8n workflow

"Scan this n8n workflow JSON and tell me if it passes Torqa's
baseline policy. If there are findings, propose fixes."

# Claude will call torqa_scan() automatically, then:
# - show trust score
# - list findings with explanations
# - propose concrete fixes`;

const SELF_HOSTED = `# Option 1: npx (no install)
npx -y @torqa/mcp-server

# Option 2: global install
npm install -g @torqa/mcp-server
torqa-mcp-server

# Environment variables:
TORQA_API_KEY=tq_live_...
TORQA_BASE_URL=https://your-torqa-instance.com  # optional`;

export function McpClient() {
  const [activeTab, setActiveTab] = useState<"claude-desktop" | "claude-code">("claude-desktop");

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">

      {/* Header */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="flex items-start gap-4"
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)" }}
        >
          <Cpu className="h-6 w-6" style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em]" style={{ color: "var(--fg-1)" }}>
            MCP Server
          </h1>
          <p className="mt-1 text-[14px] leading-relaxed" style={{ color: "var(--fg-3)" }}>
            Connect Claude and any MCP-compatible AI tool to Torqa's governance engine.
            Scan workflows, check policies, and accept risks — directly from your AI assistant.
          </p>
        </div>
      </motion.div>

      {/* Status banner */}
      <motion.div
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          background: "color-mix(in srgb, var(--emerald) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--emerald) 20%, transparent)",
        }}
      >
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: "var(--emerald)" }} />
        <p className="text-[13px]" style={{ color: "var(--fg-2)" }}>
          MCP server package: <code className="font-mono text-[12px]" style={{ color: "var(--emerald)" }}>@torqa/mcp-server</code>
          <span className="ml-3" style={{ color: "var(--fg-4)" }}>Compatible with Claude Desktop · Claude Code · any MCP client</span>
        </p>
      </motion.div>

      {/* Available tools */}
      <motion.section custom={2} variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Available tools</p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-3)" }}>
            These tools are exposed to Claude automatically when the MCP server is connected.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {MCP_TOOLS.map((tool, i) => (
            <motion.div
              key={tool.name}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              className="rounded-xl p-4 space-y-2"
              style={{ background: "var(--surface-1)", border: "1px solid var(--line)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: "var(--accent-soft)" }}
                >
                  <tool.icon className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                </div>
                <code className="text-[13px] font-semibold font-mono" style={{ color: "var(--fg-1)" }}>
                  {tool.name}
                </code>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--fg-3)" }}>
                {tool.desc}
              </p>
              <div
                className="rounded-lg px-3 py-2 font-mono text-[11px]"
                style={{ background: "var(--overlay-sm)", color: "var(--fg-4)" }}
              >
                {tool.params}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Setup guide */}
      <motion.section custom={3} variants={fadeUp} initial="hidden" animate="show" className="space-y-4">
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Setup guide</p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-3)" }}>
            Choose your Claude environment below.
          </p>
        </div>

        {/* Tab switcher */}
        <div
          className="flex gap-1 rounded-lg p-1 w-fit"
          style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
        >
          {(["claude-desktop", "claude-code"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-200"
              style={
                activeTab === tab
                  ? { background: "var(--accent)", color: "#fff" }
                  : { color: "var(--fg-3)" }
              }
            >
              {tab === "claude-desktop" ? "Claude Desktop" : "Claude Code"}
            </button>
          ))}
        </div>

        {activeTab === "claude-desktop" && (
          <div className="space-y-3">
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
            >
              <p className="mb-2 text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>
                1. Add to <code className="font-mono">~/.claude/settings.json</code>
              </p>
              <CodeBlock code={CLAUDE_DESKTOP_CONFIG} lang="json" />
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
            >
              <p className="mb-2 text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>
                2. Restart Claude Desktop — Torqa tools will appear automatically.
              </p>
              <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
                In Claude Desktop, go to <strong>Settings → Developer → MCP Servers</strong> to verify the connection.
              </p>
            </div>
          </div>
        )}

        {activeTab === "claude-code" && (
          <div className="space-y-3">
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
            >
              <p className="mb-2 text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>
                1. Create <code className="font-mono">.claude/mcp.json</code> in your project root
              </p>
              <CodeBlock code={CLAUDE_CODE_CONFIG} lang="json" />
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
            >
              <p className="mb-2 text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>
                2. Or add via CLI
              </p>
              <CodeBlock code={`claude mcp add torqa npx -y @torqa/mcp-server`} lang="bash" />
            </div>
          </div>
        )}
      </motion.section>

      {/* API key */}
      <motion.section custom={4} variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
        <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>API key</p>
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: "var(--overlay-sm)", border: "1px solid var(--line)" }}
        >
          <Key className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
          <div className="space-y-2 text-[12px]">
            <p style={{ color: "var(--fg-2)" }}>
              Get your API key from{" "}
              <a href="/settings/api" className="underline underline-offset-2 hover:opacity-70" style={{ color: "var(--accent)" }}>
                Settings → API
              </a>
              . Set it as <code className="font-mono">TORQA_API_KEY</code> in the MCP server config.
            </p>
            <p style={{ color: "var(--fg-3)" }}>
              Keys are prefixed <code className="font-mono">tq_live_</code> and have read+write scope by default.
              Create scoped keys for CI or read-only contexts.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Self-hosted server */}
      <motion.section custom={5} variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
        <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Run the MCP server manually</p>
        <CodeBlock code={SELF_HOSTED} lang="bash" />
      </motion.section>

      {/* Example usage */}
      <motion.section custom={6} variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Example usage</p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-3)" }}>
            Once connected, Claude can invoke Torqa tools from natural language prompts.
          </p>
        </div>
        <CodeBlock code={EXAMPLE_PROMPT} lang="text" />
      </motion.section>

      {/* Config reference */}
      <motion.section custom={7} variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
        <p className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>Full config reference</p>
        <CodeBlock code={CLAUDE_MCP_CONFIG} lang="json" />
      </motion.section>

    </div>
  );
}
