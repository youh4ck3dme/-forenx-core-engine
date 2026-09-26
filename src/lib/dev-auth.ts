export const DEV_FREE_ENTRY_KEY = "forendo:dev-free-entry";

/**
 * Lokálny vstup je dostupný iba na loopback hostiteľovi, nezávisle od build režimu.
 */
export function isLocalDevEnvironment(): boolean {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  }
  return false;
}

/**
 * Overí, či používateľ aktivoval lokálny vývojársky bezplatný vstup.
 * Na akejkoľvek inej ako loopback doméne je vždy neaktívny — aj keď má
 * niekto príznak uložený v prehliadači.
 */
export function isDevFreeEntryActive(): boolean {
  if (typeof window === "undefined") return false;
  if (!isLocalDevEnvironment()) return false;
  return window.localStorage.getItem(DEV_FREE_ENTRY_KEY) === "true";
}

/**
 * Aktivuje lokálny vývojársky bezplatný vstup.
 */
export function setDevFreeEntryActive(): void {
  if (typeof window !== "undefined" && isLocalDevEnvironment()) {
    window.localStorage.setItem(DEV_FREE_ENTRY_KEY, "true");
  }
}

/**
 * Zruší lokálny vývojársky bezplatný vstup (napr. pri odhlásení).
 */
export function clearDevFreeEntry(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(DEV_FREE_ENTRY_KEY);
  }
}

export type DevUser = {
  id: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  aud: string;
  confirmation_sent_at?: string;
  confirmed_at?: string;
  created_at: string;
  email?: string;
  phone?: string;
  role?: string;
  updated_at?: string;
};

/**
 * Mock používateľ pre lokálny beh bez nutnosti pripojenia na živý Supabase Auth.
 */
export const DEV_MOCK_USER: DevUser = {
  id: "00000000-0000-0000-0000-000000000001",
  app_metadata: { provider: "dev_local" },
  user_metadata: {
    name: "Dev Vyšetrovateľ (Lokál)",
    email: "dev@forendo.local",
  },
  aud: "authenticated",
  confirmation_sent_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  email: "dev@forendo.local",
  phone: "",
  role: "authenticated",
  updated_at: new Date().toISOString(),
};
