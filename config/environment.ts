import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { loadEnv } from "vite";

const publicKeys = new Set([
  "VITE_DATA_MODE",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
]);

export function resolveEnvironment(
  mode: string,
  variables: Record<string, string | undefined>,
  developmentUrl = "",
) {
  if (mode !== "development" && mode !== "production") {
    throw new Error("Use development or production mode for this workspace.");
  }
  for (const name of Object.keys(variables)) {
    if (name.startsWith("VITE_") && !publicKeys.has(name)) {
      throw new Error(
        `Unsupported browser setting ${name}. Only the three settings in the environment templates are allowed. Keep server secrets in Supabase Edge Function secrets.`,
      );
    }
  }

  const supabaseUrl = variables.VITE_SUPABASE_URL?.trim() || "";
  const supabaseAnonKey = variables.VITE_SUPABASE_ANON_KEY?.trim() || "";
  const dataMode =
    variables.VITE_DATA_MODE?.trim() ||
    (mode === "production" || supabaseUrl || supabaseAnonKey
      ? "supabase"
      : "demo");

  if (dataMode !== "demo" && dataMode !== "supabase") {
    throw new Error("VITE_DATA_MODE must be demo or supabase.");
  }
  if (mode === "production" && dataMode === "demo") {
    throw new Error(
      "Production cannot use demo accounts. Use npm run build:dev for the prototype demo, or configure the production Supabase project.",
    );
  }
  if (dataMode === "demo" && (supabaseUrl || supabaseAnonKey)) {
    throw new Error(
      "Demo mode has Supabase credentials configured. Clear both values or set VITE_DATA_MODE=supabase.",
    );
  }
  if (dataMode === "supabase") {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        `${mode}: set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.${mode}.local (or the build environment). No demo fallback is allowed in connected mode.`,
      );
    }
    let url: URL;
    try {
      url = new URL(supabaseUrl);
    } catch {
      throw new Error("VITE_SUPABASE_URL must be a valid project URL.");
    }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" &&
        !(mode === "development" && local && url.protocol === "http:")) ||
      (mode === "production" && local) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    ) {
      throw new Error(
        "Use the Supabase project root URL over HTTPS. Local HTTP is allowed only in development.",
      );
    }
    let isPublicKey = supabaseAnonKey.startsWith("sb_publishable_");
    if (!isPublicKey) {
      try {
        const parts = supabaseAnonKey.split(".");
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString(),
        );
        isPublicKey = parts.length === 3 && payload.role === "anon";
      } catch {
        // Reject secret keys and malformed credentials without printing them.
      }
    }
    if (!isPublicKey) {
      throw new Error(
        "VITE_SUPABASE_ANON_KEY must be a public anon or sb_publishable_ key. Server secrets are never allowed in the browser.",
      );
    }
    if (
      mode === "production" &&
      developmentUrl &&
      url.href.toLowerCase() === new URL(developmentUrl).href.toLowerCase()
    ) {
      throw new Error(
        "Development and production point to the same Supabase project. Use separate projects to keep test data away from production.",
      );
    }
  }
  return { environment: mode, dataMode, supabaseUrl, supabaseAnonKey };
}

function readSettings(root: string, filename: string) {
  const path = join(root, filename);
  return existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
}

export function loadWorkspaceEnvironment(mode: string, root: string) {
  for (const filename of [".env", ".env.local"]) {
    if (
      Object.keys(readSettings(root, filename)).some((k) =>
        k.startsWith("VITE_"),
      )
    ) {
      throw new Error(
        `Move VITE settings from ${filename} to .env.development.local or .env.production.local. Shared browser settings are disabled to keep the environments separate.`,
      );
    }
  }
  const development = {
    ...readSettings(root, ".env.development"),
    ...readSettings(root, ".env.development.local"),
  };
  return resolveEnvironment(
    mode,
    loadEnv(mode, root, "VITE_"),
    development.VITE_SUPABASE_URL?.trim(),
  );
}
