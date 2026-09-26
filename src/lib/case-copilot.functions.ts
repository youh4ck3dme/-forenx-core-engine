import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CopilotRequestSchema } from "./case-copilot";

export const askCaseCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CopilotRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { runCaseCopilot } = await import("./case-copilot.server");
    return runCaseCopilot(data, context);
  });
