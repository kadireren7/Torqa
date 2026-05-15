#!/usr/bin/env node
/**
 * Torqa MCP workflow server — stdio transport for Claude Desktop / Claude Code.
 * Planning only: no live Gmail/Slack execution.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createWorkflowFromPrompt,
  discoverTools,
  exportWorkflow,
  listWorkflowTemplates,
  validateWorkflow,
} from "@/lib/mcp/workflow-tools/handlers";
import type { WorkflowStepMcp } from "@/lib/mcp/workflow-tools/types";

const VERSION = "0.3.0";

function printHelp(): void {
  console.log(`Torqa MCP Workflow Server v${VERSION}

Exposes workflow planning tools for Claude and other MCP clients.
This server creates structured workflow plans — it does not execute external actions.

Usage:
  npm run mcp:server
  npx tsx src/mcp/server.ts

Options:
  --help    Show this message

Tools:
  torqa.discover_tools
  torqa.create_workflow_from_prompt
  torqa.validate_workflow
  torqa.export_workflow
  torqa.list_workflow_templates

Docs: docs/MCP_SERVER.md in the Torqa repository.
`);
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const server = new McpServer(
    {
      name: "torqa-workflow",
      version: VERSION,
    },
    {
      instructions: `Torqa turns plain-English automation requests into structured MCP workflow plans.
Use torqa.create_workflow_from_prompt for new plans, torqa.validate_workflow before export,
and torqa.export_workflow for JSON or Claude prompts. Execution of external systems is planned — not live.`,
    }
  );

  server.registerTool(
    "torqa.discover_tools",
    {
      description:
        "Given an MCP config or list of tool definitions, return a normalized tool inventory for workflow planning.",
      inputSchema: z.object({
        mcpConfig: z.record(z.string(), z.unknown()).nullable().optional(),
        tools: z.array(z.unknown()).nullable().optional(),
      }),
    },
    async (args) => {
      try {
        return jsonResult(
          discoverTools({
            mcpConfig: args.mcpConfig ?? null,
            tools: args.tools ?? null,
          })
        );
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : "discover_tools failed");
      }
    }
  );

  server.registerTool(
    "torqa.create_workflow_from_prompt",
    {
      description:
        "Turn a plain-English task into a structured MCP workflow plan (tools, steps, approvals, export JSON).",
      inputSchema: z.object({
        prompt: z.string(),
        availableTools: z.array(z.unknown()).optional(),
        mode: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        return jsonResult(
          createWorkflowFromPrompt({
            prompt: args.prompt,
            availableTools: args.availableTools,
            mode: args.mode,
          })
        );
      } catch (e) {
        return errorResult(
          e instanceof Error ? e.message : "create_workflow_from_prompt failed"
        );
      }
    }
  );

  server.registerTool(
    "torqa.validate_workflow",
    {
      description: "Validate a generated workflow plan before export or execution.",
      inputSchema: z.object({
        workflow: z.record(z.string(), z.unknown()),
      }),
    },
    async (args) => {
      try {
        return jsonResult(
          validateWorkflow({
            workflow: args.workflow as { steps?: WorkflowStepMcp[] },
          })
        );
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : "validate_workflow failed");
      }
    }
  );

  server.registerTool(
    "torqa.export_workflow",
    {
      description: "Export a workflow plan as JSON or a Claude/Cursor prompt.",
      inputSchema: z.object({
        workflow: z.record(z.string(), z.unknown()),
        format: z.enum(["json", "claude_prompt"]),
      }),
    },
    async (args) => {
      try {
        return jsonResult(
          exportWorkflow({
            workflow: args.workflow,
            format: args.format,
          })
        );
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : "export_workflow failed");
      }
    }
  );

  server.registerTool(
    "torqa.list_workflow_templates",
    {
      description: "Return example workflow templates for common automation patterns.",
      inputSchema: z.object({}),
    },
    async () => jsonResult(listWorkflowTemplates())
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
