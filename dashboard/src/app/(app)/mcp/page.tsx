import type { Metadata } from "next";
import { McpClient } from "./mcp-client";

export const metadata: Metadata = {
  title: "MCP Server",
  description: "Connect Claude and AI tools to Torqa via Model Context Protocol.",
};

export default function McpPage() {
  return <McpClient />;
}
