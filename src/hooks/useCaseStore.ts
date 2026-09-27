import type { Severity } from "@/forensic";

export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "malte:theme";

export function readStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system")
      return saved;
  } catch {
    // ignore
  }
  return null;
}

export function passesFilter(filter: Severity[], level: Severity): boolean {
  if (filter.length === 0) return true;
  return filter.includes(level);
}

