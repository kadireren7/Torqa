import type { RemediationQuestion } from "./types";

export const RULE_QUESTIONS: Record<string, RemediationQuestion[]> = {
  "mcp.exec_without_allowlist": [
    {
      id: "allow_exec",
      label: "Should this tool be allowed to run shell commands at all?",
      type: "boolean",
      required: true,
    },
    {
      id: "allowed_commands",
      label: "Which commands should be allowed? (comma-separated)",
      type: "text",
      placeholder: "npm test, npm run build, npm run lint",
      required: false,
    },
    {
      id: "require_confirmation",
      label: "Should user confirmation be required before execution?",
      type: "boolean",
      required: true,
    },
    {
      id: "environment",
      label: "Is this tool local-only or allowed in production?",
      type: "select",
      options: ["local-only", "both", "production-only"],
      required: true,
    },
  ],

  "mcp.unrestricted_filesystem_access": [
    {
      id: "access_mode",
      label: "Should the tool be read-only or allowed to write files?",
      type: "select",
      options: ["read-only", "read-write"],
      required: true,
    },
    {
      id: "allowed_paths",
      label: "Which paths should be allowed? (comma-separated)",
      type: "text",
      placeholder: "/app, ./project, /tmp",
      required: false,
    },
    {
      id: "denied_paths",
      label: "Which paths should always be denied? (comma-separated)",
      type: "text",
      placeholder: "/etc, ~/.ssh, /root",
      required: false,
    },
    {
      id: "sandbox_to_project",
      label: "Should access be limited to the project directory?",
      type: "boolean",
      required: true,
    },
  ],

  "mcp.hardcoded_secret": [
    {
      id: "move_to_env",
      label: "Should this value be moved to an environment variable?",
      type: "boolean",
      required: true,
    },
    {
      id: "env_var_name",
      label: "What env var name should be used? (e.g. API_KEY, DATABASE_URL)",
      type: "text",
      placeholder: "API_KEY",
      required: false,
    },
    {
      id: "rotate_secret",
      label: "Should this secret be rotated immediately?",
      type: "boolean",
      required: true,
    },
    {
      id: "block_in_ci",
      label: "Should the scanner block commits containing this pattern?",
      type: "boolean",
      required: true,
    },
  ],

  "mcp.overbroad_network_access": [
    {
      id: "allowed_domains",
      label: "Which domains should this tool be allowed to contact? (comma-separated)",
      type: "text",
      placeholder: "api.example.com, cdn.example.com",
      required: false,
    },
    {
      id: "block_arbitrary_urls",
      label: "Should arbitrary URLs be blocked?",
      type: "boolean",
      required: true,
    },
    {
      id: "require_user_approval",
      label: "Should requests require user approval?",
      type: "boolean",
      required: true,
    },
    {
      id: "block_internal_ips",
      label: "Should localhost and internal IP ranges be blocked?",
      type: "boolean",
      required: true,
    },
  ],

  "mcp.missing_input_validation": [
    {
      id: "accepted_fields",
      label: "What fields should this tool accept? (comma-separated)",
      type: "text",
      placeholder: "name, email, action",
      required: false,
    },
    {
      id: "required_fields",
      label: "Which fields are required? (comma-separated)",
      type: "text",
      placeholder: "name, action",
      required: false,
    },
    {
      id: "add_length_constraints",
      label: "Should strings have min/max length constraints?",
      type: "boolean",
      required: true,
    },
    {
      id: "use_enums_or_patterns",
      label: "Should enums or regex patterns be used for validation?",
      type: "boolean",
      required: true,
    },
  ],

  "mcp.ambiguous_tool_description": [
    {
      id: "clear_description",
      label: "What should this tool do in one clear sentence?",
      type: "text",
      placeholder: "Runs a predefined set of npm scripts in the project directory.",
      required: true,
    },
    {
      id: "never_do",
      label: "What must this tool never do?",
      type: "text",
      placeholder: "Never access files outside the project. Never send data externally.",
      required: false,
    },
    {
      id: "mention_permissions",
      label: "Should the description mention permission boundaries?",
      type: "boolean",
      required: true,
    },
    {
      id: "mention_confirmation",
      label: "Should the description mention confirmation requirements?",
      type: "boolean",
      required: true,
    },
  ],

  "mcp.production_deploy_without_confirmation": [
    {
      id: "require_confirmation",
      label: "Should production deploys require confirmation?",
      type: "boolean",
      required: true,
    },
    {
      id: "approvers",
      label: "Who can approve production deploys? (roles or teams, comma-separated)",
      type: "text",
      placeholder: "ops, lead-engineer, devops-team",
      required: false,
    },
    {
      id: "allowed_branches",
      label: "Should deploys be blocked outside allowed branches? (comma-separated)",
      type: "text",
      placeholder: "main, release/*",
      required: false,
    },
    {
      id: "require_ci",
      label: "Should deploys require CI to be passing?",
      type: "boolean",
      required: true,
    },
  ],

  "mcp.database_write_without_scope": [
    {
      id: "allowed_tables",
      label: "Which tables can this tool access? (comma-separated)",
      type: "text",
      placeholder: "products, orders, logs",
      required: false,
    },
    {
      id: "allowed_operations",
      label: "Which operations are allowed?",
      type: "multiselect",
      options: ["read", "insert", "update", "delete"],
      required: true,
    },
    {
      id: "confirm_destructive",
      label: "Should delete operations require confirmation?",
      type: "boolean",
      required: true,
    },
    {
      id: "block_user_tables",
      label: "Should customer/user tables be blocked?",
      type: "boolean",
      required: true,
    },
  ],
};

const DEFAULT_QUESTIONS: RemediationQuestion[] = [
  {
    id: "describe_intended_behavior",
    label: "Describe the intended behavior of this tool or config element.",
    type: "text",
    placeholder: "This tool is intended to...",
    required: true,
  },
  {
    id: "needs_human_review",
    label: "Does this require human review before changes are made?",
    type: "boolean",
    required: true,
  },
];

export function getQuestionsForRule(ruleId: string): RemediationQuestion[] {
  return RULE_QUESTIONS[ruleId] ?? DEFAULT_QUESTIONS;
}

export function getAllSupportedRuleIds(): string[] {
  return Object.keys(RULE_QUESTIONS);
}
