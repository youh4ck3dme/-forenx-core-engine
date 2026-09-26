import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Vráti dočasný podpísaný odkaz na archív so zdrojovým kódom.
 * Dostupné len pre používateľa s rolou `admin`.
 */
export const getSourceDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc(
      "has_role",
      {
        _user_id: context.userId,
        _role: "admin",
      },
    );
    if (roleError) throw new Error("Overenie oprávnení zlyhalo.");
    if (!isAdmin) throw new Error("Prístup majú len správcovia.");

    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage
      .from("private-bucket")
      .createSignedUrl("source/malte-source.zip", 300, {
        download: "malte-source.zip",
      });
    if (error || !data)
      throw new Error("Odkaz na stiahnutie sa nepodarilo vytvoriť.");
    return { url: data.signedUrl };
  });
