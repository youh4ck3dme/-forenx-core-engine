import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const payloadSchema = z.object({
  message: z.string().min(1).max(1_000),
  stack: z.string().max(8_000).optional(),
  route: z.string().max(500).optional(),
  severity: z.enum(["error", "warning", "fatal", "info"]).optional(),
});

/**
 * Zápis chyby z rozhrania. Zámerne bez prihlásenia — chyba môže nastať
 * aj pred prihlásením. Používateľa priradíme z overeného tokenu, ak existuje.
 */
export const reportClientError = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => payloadSchema.parse(data))
  .handler(async ({ data }) => {
    const { logError } = await import("./error-log.server");
    await logError({
      message: data.message,
      stack: data.stack ?? null,
      route: data.route ?? null,
      severity: data.severity ?? "error",
      source: "client",
    });
    return { ok: true };
  });
