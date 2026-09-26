import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assertAiConsent } from "./ai-consent";
import { callMistral, mistralConfigured } from "./ai/mistral.server";
import { getQuotas } from "./entitlements.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildCopilotContext,
  COPILOT_PROMPT_VERSION,
  COPILOT_SYSTEM_PROMPT,
  COURT_SUMMARY_QUESTION,
  validateCopilotAnswer,
  CopilotRequestSchema,
  type CopilotRequest,
} from "./case-copilot";
import { caseSnapshotHash } from "./court-evidence";

export async function runCaseCopilot(
  input: CopilotRequest,
  context: { supabase: SupabaseClient<Database>; userId: string },
) {
  const data = CopilotRequestSchema.parse(input);
  assertAiConsent(data.consentVersion);
  const { data: owned, error } = await context.supabase
    .from("cases")
    .select("id")
    .eq("id", data.caseId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error || !owned)
    throw new Error("Prípad sa nenašiel alebo naň nemáte oprávnenie.");
  const payload = buildCopilotContext(
    data.snapshot,
    data.task === "summary" ? COURT_SUMMARY_QUESTION : data.question,
  );
  if (!payload.evidence.length)
    return validateCopilotAnswer({ statements: [] }, data.snapshot, null);
  if (!mistralConfigured("chat"))
    throw new Error(
      "Mistral nie je nakonfigurovaný. Správca musí nastaviť serverový AI kľúč.",
    );
  const model = "mistral-large-latest";
  const quotas = await getQuotas(context.userId);
  const { data: reservationId, error: reserveError } = await supabaseAdmin.rpc(
    "reserve_ai_call",
    {
      _user: context.userId,
      _case: data.caseId,
      _task: "case_summary",
      _model: model,
      _prompt_version: COPILOT_PROMPT_VERSION,
      _input_revision: caseSnapshotHash(data.snapshot),
      _daily_limit: quotas.aiPerDay,
    },
  );
  if (reserveError || !reservationId)
    throw new Error("Denný limit AI bol vyčerpaný alebo rezervácia zlyhala.");
  let status = "failed";
  try {
    const result = await callMistral({
      purpose: "chat",
      model,
      maxTokens: 4500,
      messages: [
        { role: "system", content: COPILOT_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    if (result.status !== "ok") throw new Error(result.message);
    let raw: unknown;
    try {
      raw = JSON.parse(result.content);
    } catch {
      throw new Error("AI vrátila neplatnú odpoveď. Skúste otázku znova.");
    }
    let answer;
    try {
      answer = validateCopilotAnswer(raw, data.snapshot, result.model);
    } catch {
      throw new Error(
        "Odpoveď nemá platné odkazy na dôkazy. Nebola zobrazená.",
      );
    }
    status = "ok";
    return answer;
  } finally {
    // Only operational metadata, never document text, user questions or provider output.
    await supabaseAdmin
      .from("ai_usage")
      .update({ status, finished_at: new Date().toISOString() })
      .eq("id", reservationId);
  }
}
