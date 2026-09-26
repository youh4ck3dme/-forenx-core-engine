import type { Flag, Severity } from "../types";

export const severityOrder: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function levelFromScore(score: number): Severity {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function scoreFromFlags(flags: Flag[]): number {
  const raw = flags.reduce((sum, f) => sum + f.weight, 0);
  return Math.min(100, Math.round(raw));
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

export function formatEur(value: number): string {
  return `${new Intl.NumberFormat("sk-SK").format(Math.round(value))} €`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}
