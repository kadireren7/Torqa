import type { TorqaRequest, TorqaRunResult } from "./torqaApi";

export type TqFileOpenPayload = { workspaceRoot: string; relativePath: string };

export type TorqaShellAPI = {
  getPaths: () => Promise<{ repoRoot: string; pythonExe: string }>;
  getWorkspace: () => Promise<string | null>;
  openWorkspace: () => Promise<string | null>;
  openTqFile: () => Promise<TqFileOpenPayload | null>;
  clearWorkspace: () => Promise<void>;
  subscribeShellEvents: (handlers: {
    onWorkspaceOpened?: (dir: string) => void;
    onTqFileOpened?: (payload: TqFileOpenPayload) => void;
  }) => () => void;
  listTqFiles: (root: string) => Promise<string[]>;
  readFile: (
    root: string,
    relPath: string,
  ) => Promise<{ ok: true; content: string } | { ok: false; error: string }>;
  saveFile: (root: string, relPath: string, content: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  torqaRun: (req: TorqaRequest) => Promise<TorqaRunResult>;
  /** P80: npm run dev in generated webapp (Electron). Default: no system browser; embed URL in app. */
  startVitePreview: (
    webappAbsolute: string,
    opts?: { openExternal?: boolean },
  ) => Promise<
    | { ok: true; url: string; ready: true; port: number }
    | { ok: false; error: string; url?: string }
  >;
  /** Open a preview URL in the system browser (http/https only). */
  openExternalUrl: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  seedSampleTq: (
    workspace: string,
    which: "minimal" | "flagship",
  ) => Promise<{ ok: true; relativePath: string } | { ok: false; error: string }>;
};

declare global {
  interface Window {
    /** Yalnızca Electron + preload yüklüyken tanımlı; tarayıcıda yoktur. */
    torqaShell?: TorqaShellAPI;
  }
}

export {};
