declare const __APP_CONFIG__: {
  environment: "development" | "production";
  dataMode: "demo" | "supabase";
  supabaseUrl: string;
  supabaseAnonKey: string;
  version: string;
  revision: string;
};

export const appConfig = __APP_CONFIG__;
export const environmentLabel =
  appConfig.environment === "production" ? "Production" : "Development";
export const environmentShortLabel =
  appConfig.environment === "production" ? "Prod" : "Dev";
export const versionLabel = `v${appConfig.version}`;
export const buildLabel = `${versionLabel} · ${environmentLabel} · ${appConfig.revision}`;
