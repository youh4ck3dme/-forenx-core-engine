import { describe, expect, it } from "vitest";
import {
  AVATAR_ACCEPT,
  AVATAR_MAX_INPUT_BYTES,
  avatarStoragePath,
  isAllowedAvatarFile,
  validateAvatarFile,
} from "@/lib/avatar-prep";
import { saveProfileSchema } from "@/lib/profile.functions";

describe("avatar-prep formáty", () => {
  it("AVATAR_ACCEPT obsahuje aspoň 5 typov obrázkov", () => {
    expect(AVATAR_ACCEPT).toMatch(/jpeg/i);
    expect(AVATAR_ACCEPT).toMatch(/png/i);
    expect(AVATAR_ACCEPT).toMatch(/webp/i);
    expect(AVATAR_ACCEPT).toMatch(/gif/i);
    expect(AVATAR_ACCEPT).toMatch(/heic/i);
  });

  it.each([
    { name: "a.jpg", type: "image/jpeg" },
    { name: "a.jpeg", type: "image/jpeg" },
    { name: "a.png", type: "image/png" },
    { name: "a.webp", type: "image/webp" },
    { name: "a.gif", type: "image/gif" },
    { name: "a.heic", type: "image/heic" },
    { name: "a.heif", type: "image/heif" },
    { name: "phone.HEIC", type: "" },
  ])("povolí $name", (file) => {
    expect(isAllowedAvatarFile(file)).toBe(true);
    expect(
      validateAvatarFile(
        new File([new Uint8Array([1])], file.name, { type: file.type }),
      ),
    ).toBeNull();
  });

  it("odmietne PDF a príliš veľký súbor", () => {
    expect(
      isAllowedAvatarFile({ name: "x.pdf", type: "application/pdf" }),
    ).toBe(false);
    const huge = new File(
      [new Uint8Array(AVATAR_MAX_INPUT_BYTES + 1)],
      "big.jpg",
      { type: "image/jpeg" },
    );
    expect(validateAvatarFile(huge)).toMatch(/príliš veľká/i);
  });

  it("avatarStoragePath používa userId priečinok", () => {
    expect(avatarStoragePath("uid-1", "webp")).toBe("uid-1/avatar.webp");
    expect(avatarStoragePath("uid-1", "jpg")).toBe("uid-1/avatar.jpg");
  });
});

describe("saveProfileSchema avatarUrl", () => {
  it("prijme profil bez avatarUrl", () => {
    const parsed = saveProfileSchema.parse({
      fullName: "Ján Test",
      email: "jan@example.com",
      complete: true,
    });
    expect(parsed.avatarUrl).toBeUndefined();
  });

  it("prijme prázdny avatarUrl (odstránenie)", () => {
    const parsed = saveProfileSchema.parse({
      fullName: "Ján Test",
      email: "",
      avatarUrl: "",
      complete: true,
    });
    expect(parsed.avatarUrl).toBe("");
  });

  it("prijme http(s) URL", () => {
    const parsed = saveProfileSchema.parse({
      fullName: "Ján Test",
      email: "",
      avatarUrl:
        "https://example.supabase.co/storage/v1/object/public/avatars/u/avatar.webp",
      complete: false,
    });
    expect(parsed.avatarUrl).toContain("avatars");
  });
});
