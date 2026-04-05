export type LlmGenMode =
  | "balanced"
  | "cheapest"
  | "fastest"
  | "highest_quality"
  | "most_reliable";

export type TorqaRequest =
  | { kind: "surface"; workspaceRoot: string; relativePath: string }
  | {
      kind: "build";
      workspaceRoot: string;
      relativePath: string;
      outDir?: string;
      engineMode?: "python_only" | "rust_preferred" | "rust_only";
    }
  | { kind: "benchmark"; workspaceRoot?: string; relativePath?: string }
  | {
      kind: "generateTq";
      workspaceRoot: string;
      prompt: string;
      maxRetries?: number;
      genCategory?:
        | "landing"
        | "crud"
        | "automation"
        | "crm"
        | "onboarding"
        | "approvals"
        | "dashboard";
      /** P114: openai | anthropic | google (default: saved preference). */
      llmProvider?: "openai" | "anthropic" | "google";
      llmModel?: string;
      fallbackModel?: string;
      llmGenMode?: LlmGenMode;
      tqGenPhases?: 1 | 2 | 3;
      evolveMode?: "improve" | "add-feature";
      evolveFromRelativePath?: string;
    }
  | {
      kind: "appPipeline";
      workspaceRoot: string;
      prompt: string;
      maxRetries?: number;
      outDir?: string;
      engineMode?: "python_only" | "rust_preferred" | "rust_only";
      genCategory?:
        | "landing"
        | "crud"
        | "automation"
        | "crm"
        | "onboarding"
        | "approvals"
        | "dashboard";
      llmProvider?: "openai" | "anthropic" | "google";
      llmModel?: string;
      fallbackModel?: string;
      llmGenMode?: LlmGenMode;
      tqGenPhases?: 1 | 2 | 3;
      evolveMode?: "improve" | "add-feature";
      evolveFromRelativePath?: string;
    };

export type TorqaRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};
