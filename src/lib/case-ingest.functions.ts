import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ForensicCaseUnifiedSchema } from "@/types/forensic-case";
import { assertAiConsent } from "./ai-consent";

export const IngestRequestSchema = z
  .object({
    caseId: z.string().uuid(),
    consentVersion: z.string(),
    files: z
      .array(
        z.object({
          name: z
            .string()
            .trim()
            .min(1)
            .max(255)
            .regex(/\.(pdf|jpe?g|png|heic|csv|xlsx?|xls)$/i),
          text: z.string().min(1).max(180_000_000).optional(),
          base64: z
            .string()
            .min(1)
            .max(200_000_000)
            .regex(/^[A-Za-z0-9+/]*={0,2}$/)
            .optional(),
          mimeType: z.string().min(1).max(120),
          extractionBase64: z
            .string()
            .max(3_900_000)
            .regex(/^[A-Za-z0-9+/]*={0,2}$/)
            .optional(),
          extractionName: z
            .string()
            .max(255)
            .regex(/\.jpg$/i)
            .optional(),
        }),
      )
      .min(1)
      .max(25),
    existingCase: ForensicCaseUnifiedSchema,
  })
  .refine(
    (data) => data.existingCase.metadata.id === data.caseId,
    "Import patrí inému prípadu.",
  )
  .refine(
    (data) => data.files.every((file) => Boolean(file.base64 || file.text)),
    "Každý súbor musí obsahovať dáta alebo extrahovaný text.",
  )
  .refine(
    (data) => JSON.stringify(data).length <= 200 * 1024 * 1024,
    "Súbory a stav spisu presahujú 200 MB limit spracovania.",
  );

export const dispatchCaseIngestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IngestRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    assertAiConsent(data.consentVersion);
    const { data: owned, error } = await context.supabase
      .from("cases")
      .select("id")
      .eq("id", data.caseId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !owned)
      throw new Error("Prípad sa nenašiel alebo naň nemáte oprávnenie.");
    let cancelled = false;
    return {
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          const emit = (event: unknown) => {
            if (!cancelled)
              controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          };
          void (async () => {
            try {
              const { dispatchCaseIngest } = await import("./case-dispatcher");
              const result = await dispatchCaseIngest(
                data.caseId,
                data.files.map((file) => ({
                  name: file.name,
                  ...(file.text ? { text: file.text } : {}),
                  ...(file.base64 ? { base64: file.base64 } : {}),
                  mimeType: file.mimeType,
                  ...(file.extractionBase64
                    ? { extractionBase64: file.extractionBase64 }
                    : {}),
                  ...(file.extractionName
                    ? { extractionName: file.extractionName }
                    : {}),
                })),
                data.existingCase,
                (stage, fileName) =>
                  emit({ type: "progress", stage, fileName }),
              );
              emit({ type: "result", unifiedCase: result.unifiedCase });
            } catch {
              emit({
                type: "error",
                message:
                  "Spracovanie spisu zlyhalo. Skontrolujte formát súborov, OCR a dostupnosť služieb; pôvodný prípad ostal zachovaný.",
              });
            } finally {
              if (!cancelled) controller.close();
            }
          })();
        },
        cancel() {
          cancelled = true;
        },
      }),
    };
  });
