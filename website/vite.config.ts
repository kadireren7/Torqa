import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** P134: deep links like /product resolve to index.html in dev and preview. */
function torqaSpaFallback(): Plugin {
  const spaFallback = (
    req: { url?: string; method?: string },
    _res: unknown,
    next: () => void,
  ) => {
    const raw = req.url?.split("?")[0] ?? "";
    if (req.method !== "GET") return next();
    if (
      raw.startsWith("/api") ||
      raw.startsWith("/@") ||
      raw.startsWith("/node_modules") ||
      raw.startsWith("/src") ||
      raw === "/" ||
      raw === ""
    ) {
      return next();
    }
    const last = raw.split("/").filter(Boolean).pop() ?? "";
    if (last.includes(".") && !last.endsWith("/")) return next();
    req.url = "/";
    next();
  };
  return {
    name: "torqa-spa-fallback",
    configureServer(server) {
      server.middlewares.use(spaFallback);
    },
    configurePreviewServer(server) {
      server.middlewares.use(spaFallback);
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), torqaSpaFallback()],
  base: command === "build" ? "/static/site/" : "/",
  server:
    command === "serve"
      ? {
          port: 3000,
          strictPort: true,
          host: "127.0.0.1",
          proxy: {
            // P120: website dev is its own origin (:3000); API lives on the TORQA host (:8000).
            "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
          },
        }
      : undefined,
  preview: {
    port: 3000,
    strictPort: true,
    host: "127.0.0.1",
  },
  build: {
    outDir: path.resolve(__dirname, "dist/site"),
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
}));
