import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Import CSV: metadáta importu, atomické potvrdenie a voliteľné uloženie originálu.
 * Identita ide výhradne z overenej relácie, vlastníctvo prípadu vynucuje databáza.
 */

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 20_000;

const uuid = z.string().uuid();
const sha256 = z.string().regex(/^[0-9a-f]{64}$/, "Neplatný kontrolný súčet.");

function fail(
  error: { message?: string; code?: string } | null,
  fallback: string,
): never {
  if (error?.code === "42501")
    throw new Error("Nemáte oprávnenie na túto operáciu.");
  throw new Error(error?.message ? `${fallback} (${error.message})` : fallback);
}

/** Vytvorí záznam o importe (stav „pripravený"). Transakcie sa ešte nezapisujú. */
export const createImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        caseId: uuid,
        filename: z.string().trim().min(1).max(255),
        byteSize: z.number().int().min(1).max(IMPORT_MAX_BYTES),
        sha256,
        parserVersion: z.string().min(1).max(40),
        delimiter: z.enum([",", ";", "\t"]),
        decimalSeparator: z.enum([",", "."]),
        dateFormat: z.string().min(1).max(20),
        encoding: z.string().min(1).max(20),
        columnMapping: z.record(z.string(), z.union([z.number(), z.string()])),
        totalRows: z.number().int().min(0).max(IMPORT_MAX_ROWS),
        validRows: z.number().int().min(0).max(IMPORT_MAX_ROWS),
        errorRows: z.number().int().min(0).max(IMPORT_MAX_ROWS),
        partial: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("case_imports")
      .insert({
        user_id: context.userId,
        case_id: data.caseId,
        filename: data.filename,
        byte_size: data.byteSize,
        sha256: data.sha256,
        parser_version: data.parserVersion,
        delimiter: data.delimiter,
        decimal_separator: data.decimalSeparator,
        date_format: data.dateFormat,
        encoding: data.encoding,
        column_mapping: data.columnMapping,
        total_rows: data.totalRows,
        valid_rows: data.validRows,
        error_rows: data.errorRows,
        partial: data.partial,
      })
      .select("id")
      .single();
    if (error || !row) fail(error, "Import sa nepodarilo založiť.");
    return { id: row.id };
  });

const commitRow = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z
    .number()
    .refine((v) => v !== 0, "Suma nesmie byť nula.")
    .refine(
      (v) => Math.round(v * 100) === Math.round(v * 100),
      "Neplatná suma.",
    ),
  currency: z.string().regex(/^[A-Za-z]{3}$/),
  method: z.enum(["cash", "transfer"]),
  from_id: uuid,
  to_id: uuid,
  payer_id: uuid.nullable().optional(),
  origin_country: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .default("SK"),
  destination_country: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .default("SK"),
  description: z.string().max(2000).default(""),
  source_row: z.number().int().min(1),
});

/** Atomické potvrdenie: databázová funkcia zapíše všetky riadky, alebo žiadny. */
export const commitImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        importId: uuid,
        rows: z.array(commitRow).min(1).max(IMPORT_MAX_ROWS),
      })
      .refine((v) => v.rows.every((r) => r.from_id !== r.to_id), {
        message: "Odosielateľ a príjemca nesmú byť rovnaký subjekt.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Zápis beží len na serveri; vlastníctvo importu overuje databáza voči
    // overenej identite z auth middleware.
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin.rpc("commit_import", {
      _import: data.importId,
      _rows: data.rows,
      _actor: context.userId,
    });
    if (error) {
      await context.supabase
        .from("case_imports")
        .update({ status: "failed", error_detail: error.message.slice(0, 400) })
        .eq("id", data.importId);
      fail(error, "Import sa nepodarilo dokončiť. Nezapísal sa žiadny riadok.");
    }
    return { inserted: Number(inserted ?? 0) };
  });

/** Označí import ako zlyhaný (napr. po zrušení pred potvrdením). */
export const failImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        importId: uuid,
        reason: z.string().max(300).default("Zrušené používateľom."),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("case_imports")
      .update({ status: "failed", error_detail: data.reason })
      .eq("id", data.importId)
      .eq("status", "pending");
    if (error) fail(error, "Stav importu sa nepodarilo zmeniť.");
    return { ok: true };
  });

/**
 * Uloží originálny súbor do súkromného úložiska — až po informovanom súhlase používateľa.
 * Originál sa nikdy neprepisuje pri neskoršej editácii transakcií.
 */
export const storeImportOriginal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        importId: uuid,
        contentBase64: z.string().min(1),
        sha256,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: imp, error: readError } = await context.supabase
      .from("case_imports")
      .select("id, sha256, storage_path, original_stored")
      .eq("id", data.importId)
      .maybeSingle();
    if (readError) fail(readError, "Import sa nenašiel.");
    if (!imp) throw new Error("Import sa nenašiel.");
    if (imp.sha256 !== data.sha256)
      throw new Error("Kontrolný súčet sa nezhoduje s importom.");
    if (imp.original_stored) return { path: imp.storage_path };

    const bytes = Uint8Array.from(atob(data.contentBase64), (c) =>
      c.charCodeAt(0),
    );
    if (bytes.byteLength > IMPORT_MAX_BYTES)
      throw new Error("Súbor je príliš veľký.");

    const path = `imports/${context.userId}/${data.importId}.csv`;
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { error: uploadError } = await supabaseAdmin.storage
      .from("private-bucket")
      .upload(path, bytes, { contentType: "text/csv", upsert: false });
    if (uploadError) throw new Error("Originál sa nepodarilo uložiť.");

    const { error: updateError } = await context.supabase
      .from("case_imports")
      .update({ original_stored: true, storage_path: path })
      .eq("id", data.importId);
    if (updateError) {
      // Konzistencia DB ↔ úložisko: nedokončený zápis znamená odstránenie nahratého súboru.
      await supabaseAdmin.storage.from("private-bucket").remove([path]);
      fail(updateError, "Uloženie originálu zlyhalo.");
    }
    return { path };
  });

/** Podpísaný odkaz na originál — len pre vlastníka importu. */
export const getImportOriginalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ importId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: imp } = await context.supabase
      .from("case_imports")
      .select("id, filename, storage_path, original_stored, user_id")
      .eq("id", data.importId)
      .maybeSingle();
    if (!imp || imp.user_id !== context.userId)
      throw new Error("Import sa nenašiel.");
    if (!imp.original_stored || !imp.storage_path)
      throw new Error("Originál nie je uložený.");

    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("private-bucket")
      .createSignedUrl(imp.storage_path, 300, { download: imp.filename });
    if (error || !signed)
      throw new Error("Odkaz na stiahnutie sa nepodarilo vytvoriť.");
    return { url: signed.signedUrl };
  });
