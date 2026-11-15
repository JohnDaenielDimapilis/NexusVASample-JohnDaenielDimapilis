export type Appearance = "light" | "dark";

const STORAGE_KEY = "nexusva.appearance";

export function savedAppearance(): Appearance | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function systemAppearance(): Appearance {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function initialAppearance(): Appearance {
  return savedAppearance() ?? systemAppearance();
}

export function saveAppearance(value: Appearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // The switch still works for this session when storage is unavailable.
  }
}
