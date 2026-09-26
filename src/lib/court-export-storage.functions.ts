import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const storeCourtDossierPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        pdfBase64: z.string().min(1).max(200_000_000),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: owned, error } = await context.supabase
      .from("cases")
      .select("id")
      .eq("id", data.caseId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !owned)
      throw new Error("Prípad sa nenašiel alebo naň nemáte oprávnenie.");

    const { isS3StorageConfigured, uploadCourtDossierToS3 } =
      await import("./storage/s3.server");
    if (!isS3StorageConfigured()) return { stored: false as const };
    const storagePath = await uploadCourtDossierToS3(
      data.caseId,
      data.sha256,
      Buffer.from(data.pdfBase64, "base64"),
    );
    return { stored: true as const, storagePath };
  });
