import { contextBridge, ipcRenderer } from "electron";
import type { TorqaRequest } from "./torqaTypes";

export type TqFileOpenPayload = { workspaceRoot: string; relativePath: string };

contextBridge.exposeInMainWorld("torqaShell", {
  getPaths: () => ipcRenderer.invoke("app:getPaths") as Promise<{ repoRoot: string; pythonExe: string }>,
  getWorkspace: () => ipcRenderer.invoke("workspace:get") as Promise<string | null>,
  openWorkspace: () => ipcRenderer.invoke("workspace:open") as Promise<string | null>,
  openTqFile: () => ipcRenderer.invoke("file:openTq") as Promise<TqFileOpenPayload | null>,
  clearWorkspace: () => ipcRenderer.invoke("workspace:clear"),
  subscribeShellEvents: (handlers: {
    onWorkspaceOpened?: (dir: string) => void;
    onTqFileOpened?: (payload: TqFileOpenPayload) => void;
  }) => {
    const onWs = (_e: Electron.IpcRendererEvent, dir: string) => handlers.onWorkspaceOpened?.(dir);
    const onTq = (_e: Electron.IpcRendererEvent, payload: TqFileOpenPayload) => handlers.onTqFileOpened?.(payload);
    ipcRenderer.on("shell:workspaceOpened", onWs);
    ipcRenderer.on("shell:tqFileOpened", onTq);
    return () => {
      ipcRenderer.removeListener("shell:workspaceOpened", onWs);
      ipcRenderer.removeListener("shell:tqFileOpened", onTq);
    };
  },
  listTqFiles: (root: string) => ipcRenderer.invoke("fs:listTq", root) as Promise<string[]>,
  readFile: (root: string, relPath: string) =>
    ipcRenderer.invoke("fs:read", root, relPath) as Promise<
      { ok: true; content: string } | { ok: false; error: string }
    >,
  saveFile: (root: string, relPath: string, content: string) =>
    ipcRenderer.invoke("fs:write", root, relPath, content) as Promise<
      { ok: true } | { ok: false; error: string }
    >,
  torqaRun: (req: TorqaRequest) => ipcRenderer.invoke("torqa:run", req),
  getLlmState: () =>
    ipcRenderer.invoke("llm:getState") as Promise<{
      provider: string;
      haveOpenAi: boolean;
      haveAnthropic: boolean;
      haveGoogle: boolean;
    }>,
  setLlmProvider: (p: string) =>
    ipcRenderer.invoke("llm:setProvider", p) as Promise<{ ok: true } | { ok: false; error: string }>,
  setLlmApiKey: (slot: "openai" | "anthropic" | "google", key: string | null) =>
    ipcRenderer.invoke("llm:setKey", slot, key) as Promise<{ ok: true } | { ok: false; error: string }>,
  startVitePreview: (webappAbsolute: string, opts?: { openExternal?: boolean }) =>
    ipcRenderer.invoke("preview:startVite", webappAbsolute, opts ?? {}) as Promise<
      { ok: true; url: string; ready: true; port: number } | { ok: false; error: string; url?: string }
    >,
  openExternalUrl: (url: string) =>
    ipcRenderer.invoke("shell:openExternal", url) as Promise<{ ok: true } | { ok: false; error: string }>,
  seedSampleTq: (workspace: string, which: "minimal" | "flagship") =>
    ipcRenderer.invoke("demo:seedTq", workspace, which) as Promise<
      { ok: true; relativePath: string } | { ok: false; error: string }
    >,
  trialGetInfo: () =>
    ipcRenderer.invoke("trial:getInfo") as Promise<{
      schema: number;
      sessionId: string;
      dataDirectory: string;
      eventsFile: string;
      feedbackDirectory: string;
    }>,
  trialRecordEvent: (payload: { type: string; detail?: Record<string, unknown> }) =>
    ipcRenderer.invoke("trial:recordEvent", payload) as Promise<{ ok: true } | { ok: false; error: string }>,
  trialSaveFeedback: (body: { useful: string | null; failureCategory: string | null; comment: string | null }) =>
    ipcRenderer.invoke("trial:saveFeedback", body) as Promise<{ ok: true; path: string } | { ok: false; error: string }>,
});
