/**
 * Centrálne logovanie AI volaní do tabuľky `ai_feature_logs`.
 * Zápis beží výhradne na serveri a nikdy nesmie zhodiť samotnú AI funkciu —
 * každá chyba logovania sa iba zaznamená do konzoly.
 */

export type AiLogEntry = {
  feature: string;
  userId: string | null;
  success: boolean;
  durationMs: number;
  inputSummary?: string | null;
  outputSummary?: string | null;
  errorMessage?: string | null;
  provider?: string | null;
  model?: string | null;
};

function clip(value: string | null | undefined, max = 500): string | null {
  if (!value) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function logAiInvocation(entry: AiLogEntry): Promise<void> {
  try {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_feature_logs").insert({
      feature: entry.feature,
      user_id: entry.userId,
      success: entry.success,
      duration_ms: Math.max(0, Math.round(entry.durationMs)),
      input_summary: clip(entry.inputSummary),
      output_summary: clip(entry.outputSummary),
      error_message: clip(entry.errorMessage, 300),
      provider: entry.provider ?? null,
      model: entry.model ?? null,
    });
    if (error) console.warn("[ai-log] zápis zlyhal:", error.message);
  } catch (e) {
    console.warn("[ai-log] zápis zlyhal:", e);
  }
}

/** Obalí AI volanie meraním času a zápisom výsledku do `ai_feature_logs`. */
export async function withAiLog<T>(
  meta: {
    feature: string;
    userId: string | null;
    inputSummary?: string | null;
  },
  run: () => Promise<T>,
  describe?: (result: T) => {
    success?: boolean;
    outputSummary?: string | null;
    provider?: string | null;
    model?: string | null;
    errorMessage?: string | null;
  },
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await run();
    const info = describe?.(result) ?? {};
    await logAiInvocation({
      feature: meta.feature,
      userId: meta.userId,
      success: info.success ?? true,
      durationMs: Date.now() - startedAt,
      inputSummary: meta.inputSummary ?? null,
      outputSummary: info.outputSummary ?? null,
      errorMessage: info.errorMessage ?? null,
      provider: info.provider ?? null,
      model: info.model ?? null,
    });
    return result;
  } catch (error) {
    await logAiInvocation({
      feature: meta.feature,
      userId: meta.userId,
      success: false,
      durationMs: Date.now() - startedAt,
      inputSummary: meta.inputSummary ?? null,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
