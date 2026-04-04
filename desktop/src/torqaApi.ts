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
      genCategory?: "landing" | "crud" | "automation";
    }
  | {
      kind: "appPipeline";
      workspaceRoot: string;
      prompt: string;
      maxRetries?: number;
      outDir?: string;
      engineMode?: "python_only" | "rust_preferred" | "rust_only";
      genCategory?: "landing" | "crud" | "automation";
    };

export type TorqaRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};
