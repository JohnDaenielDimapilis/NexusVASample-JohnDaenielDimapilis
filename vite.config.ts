import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loadWorkspaceEnvironment } from "./config/environment";

export default defineConfig(({ mode }) => {
  const root = import.meta.dirname;
  const environment = loadWorkspaceEnvironment(
    mode === "test" ? "development" : mode,
    root,
  );
  const { version } = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
  let revision = "local";
  try {
    revision = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // Source ZIPs can also be built without a Git checkout.
  }
  return {
    plugins: [react()],
    // Only our validated, public allowlist is inserted into the browser bundle.
    envPrefix: [],
    define: {
      __APP_CONFIG__: JSON.stringify({ ...environment, version, revision }),
    },
    server: { port: 5173, strictPort: true },
    build: {
      outDir: `dist/${environment.environment}`,
      rollupOptions: {
        output: {
          manualChunks: {
            calendar: [
              "@fullcalendar/react",
              "@fullcalendar/daygrid",
              "@fullcalendar/timegrid",
              "@fullcalendar/interaction",
            ],
          },
        },
      },
    },
  };
});
