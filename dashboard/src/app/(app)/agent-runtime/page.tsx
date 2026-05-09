import type { Metadata } from "next";
import { AgentRuntimeClient } from "./agent-runtime-client";

export const metadata: Metadata = {
  title: "Agent Runtime",
  description: "Real-time governance for AI agent actions.",
};

export default function AgentRuntimePage() {
  return <AgentRuntimeClient />;
}
