import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Export a vymazanie údajov účtu.
 *
 * Postup mazania je krokový a zapisuje priebeh do `deletion_requests`,
 * takže čiastočné zlyhanie je viditeľné a operáciu je možné bezpečne zopakovať.
 * Identita (auth používateľ) sa odstraňuje až ako posledný krok — kým sa
 * nepodarí zmazať dáta, prihlásenie zostáva funkčné a je možné pokračovať.
 */

const CASE_TABLES = [
  "case_transactions",
  "case_relations",
  "case_weapons",
  "case_events",
  "case_entities",
  "case_imports",
] as const;

/** Kompletný export vlastných údajov vo formáte JSON. */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const tables = [
      "cases",
      ...CASE_TABLES,
      "case_audit_log",
      "ai_usage",
      "profiles",
      "subscriptions",
    ] as const;

    const payload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      userId,
      note: "Export obsahuje údaje uložené v aplikácii. Zálohy poskytovateľa infraštruktúry nie sú súčasťou exportu.",
    };

    for (const table of tables) {
      const column = table === "profiles" ? "id" : "user_id";
      // Voľná schéma: tabuľky majú rôzne stĺpce, dotaz je vždy obmedzený na vlastníka.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query = (supabase.from(table) as any)
        .select("*")
        .eq(column, userId)
        .limit(50000);
      const { data, error } = await query;
      payload[table] = error ? { error: error.message } : (data ?? []);
    }

    // Serializované ako text, aby prenos zostal jednoznačne typovaný.
    return { json: JSON.stringify(payload, null, 2) };
  });

/** Vymaže jeden prípad vrátane závislých záznamov. */
export const deleteCaseCompletely = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ caseId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: owned } = await supabase
      .from("cases")
      .select("id")
      .eq("id", data.caseId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!owned)
      throw new Error("Prípad sa nenašiel alebo naň nemáte oprávnenie.");

    const steps: { step: string; ok: boolean; detail?: string }[] = [];
    for (const table of CASE_TABLES) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("case_id", data.caseId);
      steps.push({
        step: table,
        ok: !error,
        ...(error ? { detail: error.message } : {}),
      });
      if (error)
        throw new Error(`Mazanie zlyhalo pri ${table}: ${error.message}`);
    }
    const { error } = await supabase
      .from("cases")
      .delete()
      .eq("id", data.caseId);
    if (error) throw new Error(`Prípad sa nepodarilo zmazať: ${error.message}`);

    return { ok: true, steps };
  });

/**
 * Vymazanie účtu. Vyžaduje potvrdenie e-mailom prihláseného používateľa.
 * Postup: dáta prípadov → AI výstupy → profil → identita.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ confirmEmail: z.string().trim().email() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (
      !user?.email ||
      user.email.toLowerCase() !== data.confirmEmail.toLowerCase()
    ) {
      throw new Error("Potvrdzovací e-mail sa nezhoduje s prihláseným účtom.");
    }

    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const steps: { step: string; ok: boolean; detail?: string }[] = [];

    const { data: request } = await supabaseAdmin
      .from("deletion_requests")
      .insert({ user_id: userId, scope: "account", status: "running" })
      .select("id")
      .single();

    async function run(
      step: string,
      fn: () => PromiseLike<{ error: { message: string } | null }>,
    ) {
      const { error } = await fn();
      steps.push({
        step,
        ok: !error,
        ...(error ? { detail: error.message } : {}),
      });
      if (error) throw new Error(`${step}: ${error.message}`);
    }

    try {
      for (const table of CASE_TABLES) {
        await run(table, () =>
          supabaseAdmin.from(table).delete().eq("user_id", userId),
        );
      }
      await run("cases", () =>
        supabaseAdmin.from("cases").delete().eq("user_id", userId),
      );
      await run("ai_usage", () =>
        supabaseAdmin.from("ai_usage").delete().eq("user_id", userId),
      );
      await run("case_audit_log", () =>
        supabaseAdmin.from("case_audit_log").delete().eq("user_id", userId),
      );

      // Originály nahratých súborov v privátnom úložisku.
      const { data: files } = await supabaseAdmin.storage
        .from("private-bucket")
        .list(`imports/${userId}`, { limit: 1000 });
      if (files?.length) {
        await supabaseAdmin.storage
          .from("private-bucket")
          .remove(
            files.map((f: { name: string }) => `imports/${userId}/${f.name}`),
          );
      }
      steps.push({ step: "storage", ok: true });

      await run("profiles", () =>
        supabaseAdmin.from("profiles").delete().eq("id", userId),
      );

      // Identita ide ako posledná — až keď sú dáta preukázateľne zmazané.
      const { error: authError } =
        await supabaseAdmin.auth.admin.deleteUser(userId);
      steps.push({ step: "auth", ok: !authError });
      if (authError)
        throw new Error(`Identitu sa nepodarilo zmazať: ${authError.message}`);

      if (request?.id) {
        await supabaseAdmin
          .from("deletion_requests")
          .update({
            status: "done",
            steps,
            finished_at: new Date().toISOString(),
          })
          .eq("id", request.id);
      }

      return { ok: true, steps };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Neznáma chyba.";
      if (request?.id) {
        await supabaseAdmin
          .from("deletion_requests")
          .update({
            status: "failed",
            steps,
            error_detail: detail,
            finished_at: new Date().toISOString(),
          })
          .eq("id", request.id);
      }
      throw new Error(
        `${detail} Časť údajov mohla ostať zmazaná, časť nie — operáciu môžete bezpečne zopakovať.`,
      );
    }
  });
