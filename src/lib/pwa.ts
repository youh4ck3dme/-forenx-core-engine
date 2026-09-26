/**
 * Jediné miesto registrácie service workera.
 * Nikdy sa neregistruje vo vývoji, v iframe, na neznámom hostiteľovi
 * ani pri ?sw=off.
 * Aktualizácia nikdy nevynúti reload — rozpracovaný formulár sa nestratí.
 */
const SW_URL = "/sw.js";
/** Musí sedieť s verziou vo workerovi (src/sw.ts). */
export const SW_VERSION = "forenx-sw-v7";

/** Výhradne tieto hostitelia smú mať service workera. */
function isKnownHost(hostname: string): boolean {
  return (
    hostname === "whoiswho.at" ||
    hostname === "www.whoiswho.at" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

async function unregisterExisting() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((r) =>
        (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith(SW_URL),
      )
      .map((r) => r.unregister()),
  );
}

/** Zmaže cache po starších verziách aplikácie. */
export async function purgeStaleCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.allSettled(
      keys
        .filter(
          (key) => !key.includes(SW_VERSION) && !key.startsWith("workbox-"),
        )
        .map((key) => caches.delete(key)),
    );
  } catch {
    /* prázdne */
  }
}

export async function registerServiceWorker(): Promise<
  ServiceWorkerRegistration | undefined
> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const refuse =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    !isKnownHost(window.location.hostname) ||
    new URLSearchParams(window.location.search).get("sw") === "off";

  if (refuse) {
    // Aj keď registráciu odmietneme, staré cache musia zmiznúť — inak by sa
    // servírovala zastaraná verzia aplikácie.
    await unregisterExisting();
    await purgeStaleCaches();
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, {
      scope: "/",
    });
    await purgeStaleCaches();
    return registration;
  } catch (err) {
    console.warn("[PWA] Registrácia Service Workera bola preskočená:", err);
    await unregisterExisting();
  }
  return undefined;
}

// Čistenie klientského stavu žije v src/lib/session.ts (clearClientState).
