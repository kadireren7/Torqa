/** P129: generation cost / quality preset (CLI `--llm-gen-mode`). */
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
  /** Flagship baseline on disk, or workspace-relative benchmark dir when parent folder is P31 layout. */
  | { kind: "benchmark"; workspaceRoot?: string; relativePath?: string }
  /** P76: prompt on stdin → validated .tq JSON (core ``torqa generate-tq``). */
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
      llmProvider?: "openai" | "anthropic" | "google";
      llmModel?: string;
      fallbackModel?: string;
      llmGenMode?: LlmGenMode;
      /** P116: LLM passes (default: core uses 3). */
      tqGenPhases?: 1 | 2 | 3;
      /** P117: evolve existing .tq (CLI: --evolve-mode + --evolve-from). */
      evolveMode?: "improve" | "add-feature";
      evolveFromRelativePath?: string;
    }
  /** P80: one-shot ``torqa --json app`` (generate → parse → materialize). */
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
