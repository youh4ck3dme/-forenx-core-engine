/**
 * Zápis chýb aplikácie do tabuľky `error_logs`.
 * Beží výhradne na serveri a nikdy nesmie zhodiť volajúci kód.
 */

export type ErrorSeverity = "error" | "warning" | "fatal" | "info";
export type ErrorSource = "server" | "client";

export type ErrorLogEntry = {
  message: string;
  stack?: string | null;
  route?: string | null;
  userId?: string | null;
  severity?: ErrorSeverity;
  source?: ErrorSource;
};

const MESSAGE_LIMIT = 1_000;
const STACK_LIMIT = 8_000;

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const text = String(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function logError(entry: ErrorLogEntry): Promise<void> {
  try {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("error_logs").insert({
      message: clip(entry.message, MESSAGE_LIMIT) ?? "Neznáma chyba",
      stack: clip(entry.stack, STACK_LIMIT),
      route: clip(entry.route, 500),
      user_id: entry.userId ?? null,
      severity: entry.severity ?? "error",
      source: entry.source ?? "server",
    });
    if (error) console.warn("[error-log] zápis zlyhal:", error.message);
  } catch (e) {
    console.warn("[error-log] zápis zlyhal:", e);
  }
}

/** Zabalí ľubovoľnú chybu do záznamu pre `error_logs`. */
export function toErrorLogEntry(
  error: unknown,
  meta: Omit<ErrorLogEntry, "message" | "stack"> = {},
): ErrorLogEntry {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Neznáma chyba";
  const stack = error instanceof Error ? (error.stack ?? null) : null;
  return { message, stack, ...meta };
}
