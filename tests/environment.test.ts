import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadWorkspaceEnvironment,
  resolveEnvironment,
} from "../config/environment";

const publicKey = "sb_publishable_configuration_test_only";
const connected = {
  VITE_DATA_MODE: "supabase",
  VITE_SUPABASE_URL: "https://production-test.supabase.co",
  VITE_SUPABASE_ANON_KEY: publicKey,
};
const temporaryRoots: string[] = [];
function workspace(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "nexus-env-test-"));
  temporaryRoots.push(root);
  for (const [filename, contents] of Object.entries(files)) {
    writeFileSync(join(root, filename), contents);
  }
  return root;
}
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    // Only directories created above, beneath the OS temporary directory.
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Environment boundaries", () => {
  it("keeps the development demo working without credentials", () => {
    expect(resolveEnvironment("development", {})).toMatchObject({
      environment: "development",
      dataMode: "demo",
      supabaseUrl: "",
    });
  });

  it("requires a complete connection instead of silently falling back to demo", () => {
    expect(() =>
      resolveEnvironment("development", {
        VITE_SUPABASE_URL: connected.VITE_SUPABASE_URL,
      }),
    ).toThrow("set both");
    expect(() => resolveEnvironment("production", {})).toThrow("set both");
    expect(() =>
      resolveEnvironment("development", { VITE_DATA_MODE: "supabase" }),
    ).toThrow("set both");
  });

  it("rejects production demo accounts and ambiguous demo credentials", () => {
    expect(() =>
      resolveEnvironment("production", { VITE_DATA_MODE: "demo" }),
    ).toThrow("Production cannot use demo accounts");
    expect(() =>
      resolveEnvironment("development", {
        ...connected,
        VITE_DATA_MODE: "demo",
      }),
    ).toThrow("Demo mode has Supabase credentials");
  });

  it("accepts public publishable keys for a configured production build", () => {
    expect(resolveEnvironment("production", connected)).toMatchObject({
      environment: "production",
      dataMode: "supabase",
      supabaseAnonKey: publicKey,
    });
  });

  it("accepts legacy anon JWTs but blocks service-role JWTs and secret keys", () => {
    const jwt = (role: string) =>
      `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.test-signature`;
    expect(
      resolveEnvironment("production", {
        ...connected,
        VITE_SUPABASE_ANON_KEY: jwt("anon"),
      }),
    ).toHaveProperty("dataMode", "supabase");
    for (const key of [
      jwt("service_role"),
      "sb_secret_test_only",
      "malformed",
    ]) {
      expect(() =>
        resolveEnvironment("production", {
          ...connected,
          VITE_SUPABASE_ANON_KEY: key,
        }),
      ).toThrow("must be a public anon");
    }
  });

  it("prevents unsupported browser variables from being bundled", () => {
    expect(() =>
      resolveEnvironment("development", { VITE_RESEND_API_KEY: "test-secret" }),
    ).toThrow("Unsupported browser setting VITE_RESEND_API_KEY");
  });

  it.each([
    "http://production-test.supabase.co",
    "https://localhost",
    "https://user:password@production-test.supabase.co",
    "https://production-test.supabase.co/rest/v1",
    "https://production-test.supabase.co/?key=test",
    "not-a-url",
  ])("rejects an unsafe production endpoint: %s", (url) => {
    expect(() =>
      resolveEnvironment("production", {
        ...connected,
        VITE_SUPABASE_URL: url,
      }),
    ).toThrow();
  });

  it("allows a local Supabase endpoint only in development", () => {
    expect(
      resolveEnvironment("development", {
        ...connected,
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toHaveProperty("dataMode", "supabase");
    expect(() =>
      resolveEnvironment("production", {
        ...connected,
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toThrow("HTTPS");
  });

  it("rejects using the configured development project in production", () => {
    expect(() =>
      resolveEnvironment(
        "production",
        connected,
        `${connected.VITE_SUPABASE_URL}/`,
      ),
    ).toThrow("same Supabase project");
    expect(
      resolveEnvironment(
        "production",
        connected,
        "https://development-test.supabase.co",
      ),
    ).toHaveProperty("environment", "production");
  });

  it.each([".env", ".env.local"])(
    "blocks shared browser config in %s",
    (filename) => {
      const root = workspace({ [filename]: "VITE_DATA_MODE=demo\n" });
      expect(() => loadWorkspaceEnvironment("production", root)).toThrow(
        `Move VITE settings from ${filename}`,
      );
    },
  );

  it("loads each mode's local file without crossing credentials", () => {
    const root = workspace({
      ".env.development.local": "VITE_DATA_MODE=demo\n",
      ".env.production.local": Object.entries(connected)
        .map(([name, value]) => `${name}=${value}`)
        .join("\n"),
    });
    expect(loadWorkspaceEnvironment("development", root)).toHaveProperty(
      "dataMode",
      "demo",
    );
    expect(loadWorkspaceEnvironment("production", root)).toMatchObject({
      dataMode: "supabase",
      supabaseUrl: connected.VITE_SUPABASE_URL,
    });
  });

  it("blocks a matching development database loaded from disk", () => {
    const settings = Object.entries(connected)
      .map(([name, value]) => `${name}=${value}`)
      .join("\n");
    const root = workspace({
      ".env.development.local": settings,
      ".env.production.local": settings,
    });
    expect(() => loadWorkspaceEnvironment("production", root)).toThrow(
      "same Supabase project",
    );
  });
});
