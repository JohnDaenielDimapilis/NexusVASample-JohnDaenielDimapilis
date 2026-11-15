import { Moon, Sun } from "lucide-react";
import type { Appearance } from "./appearance";

export function AppearanceSwitch({
  appearance,
  onToggle,
  className = "",
}: {
  appearance: Appearance;
  onToggle: () => void;
  className?: string;
}) {
  const dark = appearance === "dark";
  return (
    <button
      type="button"
      className={`appearance-switch ${className}`.trim()}
      onClick={onToggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span>{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
