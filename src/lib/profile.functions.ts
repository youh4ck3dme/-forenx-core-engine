import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AVATAR_STORAGE_BUCKET, avatarStoragePath } from "@/lib/avatar-prep";

/**
 * Profil používateľa. Zapisuje sa výhradne pod overené `context.userId`.
 *
 * Funkcia/útvar sa NEUKLADÁ tu — user_metadata patrí prihlásenej relácii
 * v prehliadači (`supabase.auth.updateUser`), nie serverovému klientovi bez
 * relácie. Server spravuje len riadok v `profiles`.
 */

export type MyProfileRow = {
  fullName: string;
  email: string;
  avatarUrl: string;
  onboardingCompleted: boolean;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfileRow> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email, avatar_url, onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error("Profil sa nepodarilo načítať.");

    return {
      fullName: data?.full_name ?? "",
      email: data?.email ?? "",
      avatarUrl: data?.avatar_url ?? "",
      onboardingCompleted: Boolean(data?.onboarding_completed),
    };
  });

export const saveProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Zadajte meno.").max(120),
  /** Kontaktný e-mail profilu — nemení prihlasovaciu identitu. */
  email: z.string().trim().email("Neplatný e-mail.").max(180).or(z.literal("")),
  /** Verejná URL alebo prázdny reťazec (odstránenie). */
  avatarUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v ?? undefined),
  /** Označiť onboarding za dokončený až po úspešnom uložení všetkých častí. */
  complete: z.boolean().default(true),
});

export const saveMyProfile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => saveProfileSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const row: {
      id: string;
      full_name: string;
      email: string | null;
      avatar_url?: string | null;
    } = {
      id: userId,
      full_name: data.fullName,
      email: data.email || null,
    };
    if (data.avatarUrl !== undefined) {
      row.avatar_url = data.avatarUrl || null;
    }

    // Nikdy nezhadzujeme už dokončený onboarding späť na false.
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(row, { onConflict: "id" });
    if (profileError) throw new Error("Profil sa nepodarilo uložiť.");

    if (!data.complete) return { ok: true, completed: false } as const;

    const { error: completeError } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", userId);
    if (completeError) return { ok: true, completed: false } as const;

    return { ok: true, completed: true } as const;
  });

const uploadAvatarSchema = z.object({
  mime: z.enum(["image/webp", "image/jpeg"]),
  ext: z.enum(["webp", "jpg"]),
  /** Čistý base64 bez data: prefixu. */
  base64: z.string().min(32).max(900_000),
});

async function ensureAvatarsBucket(
  admin: Awaited<
    typeof import("@/integrations/supabase/client.server")
  >["supabaseAdmin"],
) {
  const listed = await admin.storage.listBuckets();
  if (listed.error) {
    throw new Error(
      listed.error.message || "Úložisko avatara nie je dostupné.",
    );
  }
  const exists = (listed.data ?? []).some(
    (b) => b.id === AVATAR_STORAGE_BUCKET,
  );
  if (exists) {
    await admin.storage.updateBucket(AVATAR_STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 524288,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    });
    return;
  }
  const created = await admin.storage.createBucket(AVATAR_STORAGE_BUCKET, {
    public: true,
    fileSizeLimit: 524288,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });
  if (created.error && !/already exists/i.test(created.error.message)) {
    throw new Error(
      `Úložisko avatara chýba (bucket not found). ${created.error.message}`,
    );
  }
}

/** Nahratie avatara cez service role — obíde chýbajúce Storage RLS policies. */
export const uploadMyAvatar = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => uploadAvatarSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    await ensureAvatarsBucket(supabaseAdmin);

    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength < 32 || bytes.byteLength > 524288) {
      throw new Error("Fotka má neplatnú veľkosť po úprave.");
    }
    const path = avatarStoragePath(userId, data.ext);
    const { error: uploadError } = await supabaseAdmin.storage
      .from(AVATAR_STORAGE_BUCKET)
      .upload(path, bytes, {
        upsert: true,
        contentType: data.mime,
        cacheControl: "3600",
      });
    if (uploadError) {
      const msg = uploadError.message || "Fotku sa nepodarilo nahrať.";
      if (/bucket|not found/i.test(msg)) {
        throw new Error(
          "Úložisko avatara nie je pripravené (bucket not found). Skúste znova — server ho vytvorí automaticky.",
        );
      }
      throw new Error(msg);
    }
    const { data: pub } = supabaseAdmin.storage
      .from(AVATAR_STORAGE_BUCKET)
      .getPublicUrl(path);
    const url = pub.publicUrl;
    return {
      avatarUrl: `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`,
    } as const;
  });

export const removeMyAvatarFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage
      .from(AVATAR_STORAGE_BUCKET)
      .remove([
        avatarStoragePath(userId, "webp"),
        avatarStoragePath(userId, "jpg"),
      ]);
    return { ok: true } as const;
  });
