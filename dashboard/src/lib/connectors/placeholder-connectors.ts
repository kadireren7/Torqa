import type { Connector } from "./types";

export const zapierConnector: Connector = {
  id: "zapier",
  name: "Zapier",
  description: "Scan Zap orchestrations for governance violations.",
  status: "coming_soon",
  authType: "apikey",
  credentialFields: [],
  capabilities: ["scan_workflow"],
  docsUrl: "https://zapier.com/developer",
};

export const makeConnector: Connector = {
  id: "make",
  name: "Make",
  description: "Scenario-level governance for Make (formerly Integromat) workflows.",
  status: "coming_soon",
  authType: "apikey",
  credentialFields: [],
  capabilities: ["scan_workflow"],
  docsUrl: "https://www.make.com/en/api-documentation",
};

export const pipedreamConnector: Connector = {
  id: "pipedream",
  name: "Pipedream",
  description: "Connect Pipedream workflows for continuous risk monitoring.",
  status: "coming_soon",
  authType: "apikey",
  credentialFields: [],
  capabilities: ["scan_workflow"],
  docsUrl: "https://pipedream.com/docs/api/",
};

export const aiAgentConnector: Connector = {
  id: "ai-agent",
  name: "AI Agent",
  description: "Govern AI agent workflows and LLM pipelines. Policy enforcement for agentic systems.",
  status: "coming_soon",
  authType: "none",
  credentialFields: [],
  capabilities: ["scan_workflow"],
};
