/**
 * Profil uložený len na tomto zariadení — používa sa pri vstupe heslom,
 * ktorý nie je skutočnou cloudovou identitou. Nikdy sa nevydáva za uložený v účte.
 */
const LOCAL_PROFILE_KEY = "forenx:local-profile";

export type LocalProfile = {
  fullName: string;
  email: string;
  office: string;
  /** Data URL alebo prázdny reťazec. */
  avatarUrl: string;
  completed: boolean;
};

export const emptyLocalProfile: LocalProfile = {
  fullName: "",
  email: "",
  office: "",
  avatarUrl: "",
  completed: false,
};

export function readLocalProfile(): LocalProfile {
  if (typeof window === "undefined") return emptyLocalProfile;
  try {
    const raw = window.localStorage.getItem(LOCAL_PROFILE_KEY);
    if (!raw) return emptyLocalProfile;
    const parsed = JSON.parse(raw) as Partial<LocalProfile>;
    return {
      fullName: String(parsed.fullName ?? ""),
      email: String(parsed.email ?? ""),
      office: String(parsed.office ?? ""),
      avatarUrl: String(parsed.avatarUrl ?? ""),
      completed: Boolean(parsed.completed),
    };
  } catch {
    return emptyLocalProfile;
  }
}

/**
 * Zlyhanie úložiska (plná kvóta, súkromný režim) sa NIKDY nemlčí —
 * inak by sme používateľovi ohlásili uloženie, ktoré sa nestalo.
 */
export function writeLocalProfile(profile: LocalProfile): void {
  if (typeof window === "undefined") {
    throw new Error("Profil sa nepodarilo uložiť na tomto zariadení.");
  }
  try {
    window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    throw new Error(
      "Úložisko prehliadača odmietlo zápis, profil sa neuložil. Uvoľnite miesto a skúste znova.",
    );
  }
}
