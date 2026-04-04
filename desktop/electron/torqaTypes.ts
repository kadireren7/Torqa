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
      genCategory?: "landing" | "crud" | "automation";
    }
  /** P80: one-shot ``torqa --json app`` (generate → parse → materialize). */
  | {
      kind: "appPipeline";
      workspaceRoot: string;
      prompt: string;
      maxRetries?: number;
      outDir?: string;
      engineMode?: "python_only" | "rust_preferred" | "rust_only";
      genCategory?: "landing" | "crud" | "automation";
    };
