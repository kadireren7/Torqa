import { describe, expect, it } from "vitest";
import { analyzeMcp, isLikelyMcp } from "./mcp";
import { riskScoreFromFindings, decisionFrom } from "@/lib/scan-engine";

function hasRule(findings: { rule_id: string }[], ruleId: string): boolean {
  return findings.some((f) => f.rule_id === ruleId);
}

function findingsWithRule(findings: { rule_id: string; target: string }[], ruleId: string) {
  return findings.filter((f) => f.rule_id === ruleId);
}

const UNSAFE_SAMPLE = {
  serverInfo: { name: "dev-assistant", version: "1.0.0" },
  config: {
    api_key: "sk-proj-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456",
    database_url: "postgresql://admin:hunter2@prod-db.internal:5432/main",
  },
  tools: [
    {
      name: "run_command",
      description: "Runs a shell command on the server",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
        required: ["command"],
      },
    },
    {
      name: "write_file",
      description: "Writes content to a file on the filesystem",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "fetch_url",
      description: "Fetches content from any URL on the internet",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string" },
        },
        required: ["url"],
      },
    },
    {
      name: "query_database",
      description: "Executes a SQL query against the production database",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
    {
      name: "deploy_production",
      description: "Deploys a service to the production environment",
      inputSchema: {
        type: "object",
        properties: {
          service: { type: "string" },
          version: { type: "string" },
        },
        required: ["service", "version"],
      },
    },
    {
      name: "helper_tool",
      description: "Helper tool that manages things",
      inputSchema: { type: "object", properties: {} },
    },
  ],
};

describe("MCP adapter — isLikelyMcp", () => {
  it("detects MCP config with serverInfo + tools", () => {
    expect(isLikelyMcp(UNSAFE_SAMPLE)).toBe(true);
  });

  it("detects MCP config with tools array and inputSchema", () => {
    const manifest = {
      tools: [
        { name: "my_tool", description: "does stuff", inputSchema: { type: "object", properties: {} } },
      ],
    };
    expect(isLikelyMcp(manifest)).toBe(true);
  });

  it("detects mcpServers key", () => {
    expect(isLikelyMcp({ mcpServers: {} })).toBe(true);
  });

  it("returns false for n8n workflow", () => {
    const n8n = { nodes: [{ type: "n8n-nodes-base.webhook" }], connections: {} };
    expect(isLikelyMcp(n8n)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isLikelyMcp(null)).toBe(false);
  });
});

describe("MCP adapter — analyzeMcp (unsafe sample)", () => {
  const findings = analyzeMcp(UNSAFE_SAMPLE);

  it("detects exec_without_allowlist", () => {
    expect(hasRule(findings, "mcp.exec_without_allowlist")).toBe(true);
  });

  it("exec_without_allowlist targets run_command", () => {
    const matches = findingsWithRule(findings, "mcp.exec_without_allowlist");
    expect(matches.some((f) => f.target.includes("run_command"))).toBe(true);
  });

  it("detects hardcoded_secret", () => {
    expect(hasRule(findings, "mcp.hardcoded_secret")).toBe(true);
  });

  it("hardcoded_secret targets config.api_key", () => {
    const matches = findingsWithRule(findings, "mcp.hardcoded_secret");
    expect(matches.some((f) => f.target.includes("api_key"))).toBe(true);
  });

  it("detects unrestricted_filesystem_access", () => {
    expect(hasRule(findings, "mcp.unrestricted_filesystem_access")).toBe(true);
  });

  it("unrestricted_filesystem_access targets write_file", () => {
    const matches = findingsWithRule(findings, "mcp.unrestricted_filesystem_access");
    expect(matches.some((f) => f.target.includes("write_file"))).toBe(true);
  });

  it("detects overbroad_network_access", () => {
    expect(hasRule(findings, "mcp.overbroad_network_access")).toBe(true);
  });

  it("detects production_deploy_without_confirmation", () => {
    expect(hasRule(findings, "mcp.production_deploy_without_confirmation")).toBe(true);
  });

  it("detects database_write_without_scope", () => {
    expect(hasRule(findings, "mcp.database_write_without_scope")).toBe(true);
  });

  it("risk score is below 60 (should be BLOCK)", () => {
    const score = riskScoreFromFindings(findings);
    expect(score).toBeLessThan(60);
  });

  it("decision is FAIL", () => {
    const decision = decisionFrom(findings);
    expect(decision).toBe("FAIL");
  });

  it("has at least 3 critical findings", () => {
    const criticals = findings.filter((f) => f.severity === "critical");
    expect(criticals.length).toBeGreaterThanOrEqual(3);
  });
});

describe("MCP adapter — analyzeMcp (safe tool)", () => {
  const safeTool = {
    serverInfo: { name: "read-only-assistant", version: "1.0.0" },
    tools: [
      {
        name: "get_weather",
        description: "Fetches current weather data from the weather API for a specific city",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name",
              minLength: 1,
              maxLength: 100,
            },
          },
          required: ["city"],
          additionalProperties: false,
        },
        allowedDomains: ["api.weather.example.com"],
      },
    ],
  };

  it("does not flag a well-scoped tool as critical", () => {
    const findings = analyzeMcp(safeTool);
    const criticals = findings.filter((f) => f.severity === "critical");
    expect(criticals.length).toBe(0);
  });
});

describe("MCP adapter — analyzeMcp (exec with allowlist)", () => {
  const safeExecTool = {
    serverInfo: { name: "restricted-runner", version: "1.0.0" },
    tools: [
      {
        name: "run_command",
        description: "Runs an allowed shell command",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              enum: ["npm test", "npm run lint", "npm run build"],
            },
          },
          required: ["command"],
        },
      },
    ],
  };

  it("does not flag exec tool that has allowlist enum", () => {
    const findings = analyzeMcp(safeExecTool);
    expect(hasRule(findings, "mcp.exec_without_allowlist")).toBe(false);
  });
});

describe("MCP adapter — analyzeMcp (invalid input)", () => {
  it("handles non-object input", () => {
    const findings = analyzeMcp("not an object");
    expect(hasRule(findings, "mcp.shape_mismatch")).toBe(true);
  });

  it("handles empty tools array", () => {
    const findings = analyzeMcp({ serverInfo: { name: "empty" }, tools: [] });
    expect(findings.length).toBeGreaterThanOrEqual(0);
  });
});
