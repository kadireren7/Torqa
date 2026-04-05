import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { fileURLToPath } from "node:url";
import * as fsSafe from "./fsSafe";
import { resolvePythonExe, resolveRepoRoot } from "./paths";
import { getLlmKeyPresence, setLlmApiKey, setLlmProvider, type LlmProviderId } from "./llmKeysStore";
import { runTorqa } from "./torqaSpawn";
import { seedSampleTq } from "./demoSeed";
import type { TorqaRequest } from "./torqaTypes";
import {
  appendTrialEvent,
  getTrialTelemetryInfo,
  initTrialSession,
  saveTrialFeedback,
} from "./trialTelemetry";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function npmCmd(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

const VITE_PORT_FIRST = 5173;
const VITE_PORT_LAST = 5228;

/** Pick a free TCP port on loopback (OS-assigned) when 5173–5228 are all busy. */
function allocateLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object" && typeof addr.port === "number") {
        const p = addr.port;
        srv.close(() => resolve(p));
      } else {
        srv.close(() => reject(new Error("Could not read ephemeral port")));
      }
    });
  });
}

/** True if nothing is listening on 127.0.0.1:port (we can bind). */
function isLoopbackPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.once("error", () => resolve(false));
    srv.listen(port, "127.0.0.1", () => {
      srv.close(() => resolve(true));
    });
  });
}

/** Prefer Vite defaults: 5173, 5174, … until a free slot is found. */
async function pickPreviewPort(): Promise<number> {
  for (let p = VITE_PORT_FIRST; p <= VITE_PORT_LAST; p++) {
    if (await isLoopbackPortFree(p)) return p;
  }
  return allocateLocalPort();
}

/** Single GET / with short timeout (Vite dev answers 200 on /). */
function httpPingOnce(baseUrl: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    try {
      const u = new URL(baseUrl);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port ? Number(u.port) : 80,
          path: "/",
          method: "GET",
          timeout: timeoutMs,
          headers: { Connection: "close", Accept: "*/*" },
        },
        (res) => {
          res.resume();
          const code = res.statusCode ?? 0;
          finish(code >= 200 && code < 500);
        },
      );
      req.on("error", () => finish(false));
      req.on("timeout", () => {
        req.destroy();
        finish(false);
      });
      req.end();
    } catch {
      finish(false);
    }
  });
}

/** Poll until dev server responds or deadline (preview ready detection). */
async function waitForDevServerReady(
  baseUrl: string,
  totalMs: number,
  intervalMs: number,
): Promise<boolean> {
  const deadline = Date.now() + totalMs;
  while (Date.now() < deadline) {
    if (await httpPingOnce(baseUrl, Math.min(2500, intervalMs + 2000))) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function npmMissingFallbackMessage(webappDir: string): string {
  const sep = process.platform === "win32" ? "\\" : "/";
  const d = webappDir.replace(/\\/g, sep);
  return [
    "npm was not found (Node.js is missing or not on PATH).",
    "",
    "Fallback — run the preview yourself:",
    `  cd "${d}"`,
    "  npm install",
    "  npm run dev -- --host 127.0.0.1 --port 5173",
    "",
    "Install Node.js LTS: https://nodejs.org/",
    "Then fully quit and restart TORQA Desktop so it picks up PATH.",
  ].join("\n");
}

let mainWindow: BrowserWindow | null = null;
let workspaceRoot: string | null = null;

function dialogParent(): BrowserWindow | undefined {
  const w = mainWindow ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (w && !w.isDestroyed()) return w;
  return undefined;
}

async function pickWorkspaceDirectory(): Promise<string | null> {
  const parent = dialogParent();
  const opts = {
    defaultPath: homedir(),
    properties: ["openDirectory" as const],
    title: "Open TORQA project folder",
  };
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
  if (r.canceled || !r.filePaths[0]) return null;
  workspaceRoot = r.filePaths[0];
  return workspaceRoot;
}

async function pickTqFile(): Promise<{ workspaceRoot: string; relativePath: string } | null> {
  const parent = dialogParent();
  const opts = {
    defaultPath: homedir(),
    title: "Open a .tq file",
    filters: [
      { name: "TORQA surface", extensions: ["tq"] },
      { name: "All files", extensions: ["*"] },
    ],
    properties: ["openFile" as const],
  };
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
  if (r.canceled || !r.filePaths[0]) return null;
  const abs = path.resolve(r.filePaths[0]);
  const dir = path.dirname(abs);
  const rel = path.relative(dir, abs).split(path.sep).join("/");
  workspaceRoot = dir;
  return { workspaceRoot: dir, relativePath: rel };
}

function notifyWorkspaceOpened(dir: string) {
  mainWindow?.webContents.send("shell:workspaceOpened", dir);
}

function notifyTqFileOpened(payload: { workspaceRoot: string; relativePath: string }) {
  mainWindow?.webContents.send("shell:tqFileOpened", payload);
}

function installMenu() {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ label: app.name, submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] }]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Open Folder…",
          accelerator: "CmdOrCtrl+Shift+O",
          click: async () => {
            const p = await pickWorkspaceDirectory();
            if (p) notifyWorkspaceOpened(p);
          },
        },
        {
          label: "Open .tq File…",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const r = await pickTqFile();
            if (r) notifyTqFileOpened(r);
          },
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    title: "TORQA Desktop",
    backgroundColor: "#1a1d24",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("[TORQA Desktop] Preload failed:", preloadPath, error);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (process.env.TORQA_DESKTOP_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  initTrialSession();
  // P133: correct taskbar / jump list grouping on Windows (must match package.json build.appId).
  if (process.platform === "win32") {
    app.setAppUserModelId("dev.torqa.desktop");
  }
  installMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("app:getPaths", () => ({
  repoRoot: resolveRepoRoot(),
  pythonExe: resolvePythonExe(),
}));

ipcMain.handle("workspace:get", () => workspaceRoot);

ipcMain.handle("workspace:open", () => pickWorkspaceDirectory());

ipcMain.handle("file:openTq", () => pickTqFile());

ipcMain.handle("workspace:clear", () => {
  workspaceRoot = null;
  return null;
});

ipcMain.handle("fs:listTq", async (_, root: string) => {
  try {
    return await fsSafe.listTqFiles(root);
  } catch {
    return [];
  }
});

ipcMain.handle("fs:read", async (_, root: string, relPath: string) => {
  try {
    const content = await fsSafe.readTextFile(root, relPath);
    return { ok: true as const, content };
  } catch (e) {
    return { ok: false as const, error: String(e) };
  }
});

ipcMain.handle("fs:write", async (_, root: string, relPath: string, content: string) => {
  try {
    await fsSafe.writeTextFile(root, relPath, content);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: String(e) };
  }
});

ipcMain.handle("torqa:run", async (_, req: TorqaRequest) => runTorqa(req));

ipcMain.handle("llm:getState", () => getLlmKeyPresence());

ipcMain.handle("llm:setProvider", (_, raw: string) => {
  const v = String(raw || "openai").toLowerCase();
  if (v !== "openai" && v !== "anthropic" && v !== "google") {
    return { ok: false as const, error: "Invalid provider" };
  }
  setLlmProvider(v as LlmProviderId);
  return { ok: true as const };
});

ipcMain.handle("llm:setKey", (_, slot: string, key: string | null) => {
  try {
    const s = String(slot || "").toLowerCase();
    if (s !== "openai" && s !== "anthropic" && s !== "google") {
      return { ok: false as const, error: "Invalid key slot" };
    }
    setLlmApiKey(s as LlmProviderId, key);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: String(e) };
  }
});

ipcMain.handle("shell:openExternal", async (_, raw: string) => {
  const u = String(raw ?? "").trim();
  if (!/^https?:\/\//i.test(u)) {
    return { ok: false as const, error: "Only http(s) URLs can be opened from the app." };
  }
  try {
    await shell.openExternal(u);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: String(e) };
  }
});

/**
 * P82: npm check, port 5173→5228 fallback, spawn Vite, HTTP health ping.
 * Embedded preview loads the URL in the renderer iframe; optional openExternal for system browser.
 */
ipcMain.handle(
  "preview:startVite",
  async (_, webappAbsolute: string, opts?: { openExternal?: boolean }) => {
  const dir = path.resolve(webappAbsolute);
  const pkg = path.join(dir, "package.json");
  if (!fs.existsSync(pkg)) {
    return {
      ok: false as const,
      error: "No package.json in this folder — build may not have produced generated/webapp. Run Build again.",
    };
  }
  const npm = npmCmd();
  try {
    await execFileAsync(npm, ["-v"], {
      cwd: dir,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
  } catch {
    return {
      ok: false as const,
      error: npmMissingFallbackMessage(dir),
    };
  }
  const nm = path.join(dir, "node_modules");
  if (!fs.existsSync(nm)) {
    try {
      await execFileAsync(npm, ["install"], {
        cwd: dir,
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (e) {
      return {
        ok: false as const,
        error: `npm install failed (network or registry). Try in a terminal: cd "${dir}" && npm install\n\n${String(e)}`,
      };
    }
  }
  let port: number;
  try {
    port = await pickPreviewPort();
  } catch (e) {
    return { ok: false as const, error: `Could not pick a free port: ${String(e)}` };
  }
  const url = `http://127.0.0.1:${port}`;
  try {
    const child = spawn(
      npm,
      ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
      { cwd: dir, detached: true, stdio: "ignore", windowsHide: true },
    );
    child.unref();
  } catch (e) {
    return { ok: false as const, error: `Could not start Vite: ${String(e)}` };
  }

  const ready = await waitForDevServerReady(url, 45_000, 280);
  if (!ready) {
    return {
      ok: false as const,
      url,
      error: [
        "Dev server health check timed out (no HTTP response on /).",
        `URL tried: ${url}`,
        "The server may still be starting, or `npm run dev` failed. Check a terminal in that folder, or open the URL manually.",
      ].join("\n"),
    };
  }

  if (opts?.openExternal) {
    try {
      await shell.openExternal(url);
    } catch (e) {
      return {
        ok: false as const,
        url,
        error: `Server responded but the browser could not be opened: ${String(e)}\nOpen manually: ${url}`,
      };
    }
  }

  return { ok: true as const, url, ready: true as const, port };
  },
);

ipcMain.handle(
  "demo:seedTq",
  async (_, workspace: string, which: "minimal" | "flagship") => seedSampleTq(workspace, which),
);

/** P135: local session telemetry (NDJSON) + optional feedback JSON — never uploaded automatically. */
ipcMain.handle("trial:getInfo", () => getTrialTelemetryInfo());

ipcMain.handle(
  "trial:recordEvent",
  async (_, payload: { type: string; detail?: Record<string, unknown> }) => appendTrialEvent(payload),
);

ipcMain.handle(
  "trial:saveFeedback",
  async (
    _,
    body: { useful: string | null; failureCategory: string | null; comment: string | null },
  ) => saveTrialFeedback(body),
);
