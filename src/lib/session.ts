/**
 * Jediné miesto na odhlásenie a vyčistenie klientského stavu.
 * Zlyhanie jedného úložiska nesmie zabrániť vyčisteniu ostatných
 * a zlyhanie siete nesmie nechať zariadenie prihlásené.
 */
import type { QueryClient } from "@tanstack/react-query";
import { clearDevFreeEntry } from "@/lib/dev-auth";
import { idbClear } from "@/lib/idb";
import { beginIntentionalSignOut } from "@/lib/session-guard";

/** Po úmyselnom odhlásení — welcome page (nie /auth). */
export const POST_SIGN_OUT_ROUTE = "/" as const;

/** Kľúče v localStorage, ktoré patria tejto aplikácii. */
const APP_STORAGE_PREFIXES = ["forendo:", "forenx:", "malte:"];

/** Pozostatok po zrušenom zdieľanom hesle — pri čistení ho zahodíme. */
const LEGACY_PIN_KEY = "forendo:pin-entry";

function clearLegacyPinEntry(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_PIN_KEY);
}

/** Signál pre pamäťové providery (prípad, lokálny stav), aby sa vyprázdnili. */
export const SESSION_RESET_EVENT = "forenx:session-reset";

export function broadcastSessionReset(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(SESSION_RESET_EVENT));
  } catch {
    /* prázdne */
  }
}

function clearWebStorage(): void {
  try {
    const remove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && APP_STORAGE_PREFIXES.some((p) => key.startsWith(p))) {
        remove.push(key);
      }
    }
    remove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* zablokované úložisko nesmie zastaviť zvyšok čistenia */
  }
  try {
    window.sessionStorage.clear();
  } catch {
    /* prázdne */
  }
}

async function clearCaches(): Promise<void> {
  try {
    if (!("caches" in window)) return;
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
  } catch {
    /* prázdne */
  }
}

/**
 * Vyčistí lokálny stav aplikácie. Nemaže cudzie IndexedDB databázy.
 * `queryClient` je nepovinný — ak je zadaný, najprv sa zrušia bežiace dotazy,
 * aby rozbehnuté načítania nenaplnili pamäť späť starými dátami.
 */
export async function clearClientState(
  queryClient?: QueryClient,
): Promise<void> {
  if (typeof window === "undefined") return;

  if (queryClient) {
    try {
      await queryClient.cancelQueries();
    } catch {
      /* prázdne */
    }
    try {
      queryClient.clear();
    } catch {
      /* prázdne */
    }
  }

  // Každé úložisko zvlášť — SecurityError v jednom nesmie zhodiť ostatné.
  try {
    clearLegacyPinEntry();
  } catch {
    /* prázdne */
  }
  try {
    clearDevFreeEntry();
  } catch {
    /* prázdne */
  }
  clearWebStorage();

  try {
    await idbClear();
  } catch {
    /* prázdne */
  }

  await clearCaches();

  // Pamäťové providery zahodia dáta predchádzajúceho účtu.
  broadcastSessionReset();

  // Druhé vyčistenie pamäte dotazov — zachytí výsledky, ktoré dobehli medzitým.
  if (queryClient) {
    try {
      queryClient.clear();
    } catch {
      /* prázdne */
    }
  }
}

type SignOutClient = {
  auth: {
    signOut: (options?: { scope?: "global" | "local" }) => Promise<unknown>;
  };
};

/**
 * Jediný tok odhlásenia pre všetky obrazovky: najprv sieťové odhlásenie,
 * pri zlyhaní lokálne zneplatnenie relácie, a čistenie vždy v `finally`.
 */
export async function signOutEverywhere(
  client: SignOutClient,
  queryClient?: QueryClient,
): Promise<{ networkSignOut: boolean }> {
  let networkSignOut = true;
  beginIntentionalSignOut();
  try {
    await client.auth.signOut();
  } catch {
    networkSignOut = false;
    try {
      // Sieť zlyhala — reláciu zrušíme aspoň lokálne.
      await client.auth.signOut({ scope: "local" });
    } catch {
      /* prázdne */
    }
  } finally {
    await clearClientState(queryClient);
  }
  return { networkSignOut };
}

/**
 * Prechod z lokálneho režimu (vstup heslom) na skutočný účet.
 * Lokálne príznaky a pamäťový stav zahodíme, aby sa práca jednej identity
 * nezamiešala do druhej. Reláciu ani profil v cloude sa nedotýkame.
 */
export function adoptCloudSession(queryClient?: QueryClient): void {
  if (typeof window === "undefined") return;
  try {
    clearLegacyPinEntry();
  } catch {
    /* prázdne */
  }
  try {
    clearDevFreeEntry();
  } catch {
    /* prázdne */
  }
  try {
    window.localStorage.removeItem("malte:active-case");
  } catch {
    /* prázdne */
  }
  broadcastSessionReset();
  try {
    queryClient?.clear();
  } catch {
    /* prázdne */
  }
}
