/**
 * Jedna spoľahlivá identita pre celú aplikáciu.
 *
 * Pravidlo: skutočná Supabase relácia má VŽDY prednosť pred lokálnym vstupom
 * heslom. Kľúčom je nemenné `user.id`, nikdy kontaktný e-mail (ten sa dá meniť
 * a nie je jedinečný).
 */
import { supabase } from "@/integrations/supabase/client";
import { isDevFreeEntryActive, isLocalDevEnvironment } from "@/lib/dev-auth";
import { SessionExpiredError } from "@/lib/session-expired";

export type Identity =
  | { mode: "cloud"; userId: string; key: string; email: string }
  | { mode: "local"; userId: null; key: "local"; email: "" }
  | { mode: "none"; userId: null; key: "none"; email: "" };

export const NO_IDENTITY: Identity = {
  mode: "none",
  userId: null,
  key: "none",
  email: "",
};

/** Overená identita — `getUser()` si ju potvrdí u Supabase Auth. */
export async function resolveIdentity(): Promise<Identity> {
  if (typeof window === "undefined") return NO_IDENTITY;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const { data: verified } = await supabase.auth.getUser();
      const user = verified?.user;
      if (user) {
        return {
          mode: "cloud",
          userId: user.id,
          key: user.id,
          email: user.email ?? "",
        };
      }
    }
  } catch {
    /* sieťová chyba → skúsime lokálny režim nižšie */
  }
  if (isDevFreeEntryActive()) {
    return { mode: "local", userId: null, key: "local", email: "" };
  }
  return NO_IDENTITY;
}

/**
 * Rýchla otázka pre dátovú vrstvu: pracujeme lokálne (bez cloudového účtu)?
 * Lokálny režim je možný IBA na loopback hostiteľovi so zapnutým dev vstupom.
 */
export async function isLocalOnlyMode(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!isLocalDevEnvironment()) return false;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return false;
  } catch {
    /* bez relácie môže na localhoste pokračovať dev vstup */
  }
  return isDevFreeEntryActive();
}

/** Je relácia ešte platná (nevypršala)? */
function isSessionLive(
  session: { expires_at?: number | null } | null,
): boolean {
  if (!session) return false;
  const expiresAt = session.expires_at;
  if (typeof expiresAt !== "number") return true;
  return expiresAt * 1000 > Date.now();
}

/**
 * Rozhodne, či dátová vrstva smie čítať/zapisovať lokálne alebo musí ísť
 * do cloudu. V produkcii bez platnej relácie vyhodí `SessionExpiredError` —
 * nikdy nepodstrčí dev ani demo prípad namiesto skutočných dát.
 */
export async function shouldUseLocalCaseStore(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (await isLocalOnlyMode()) return true;

  let session: { expires_at?: number | null; user?: unknown } | null = null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new SessionExpiredError();
    session = data.session;
  } catch (error) {
    if (error instanceof SessionExpiredError) throw error;
    throw new SessionExpiredError();
  }

  if (!session?.user || !isSessionLive(session)) {
    throw new SessionExpiredError();
  }
  return false;
}
