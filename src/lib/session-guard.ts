/**
 * Jedno miesto, kde sa reaguje na vypršanú reláciu: oznámenie + presmerovanie
 * na prihlásenie. Viacnásobné volania sa zlúčia do jedného presmerovania.
 */
import { toast } from "sonner";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/session-expired";

const SIGN_IN_ROUTE = "/auth";

let handling = false;

/** Cesty, kde oznámenie nemá zmysel — používateľ už je na prihlásení/úvode. */
function isPublicEntryPath(pathname: string): boolean {
  return pathname === SIGN_IN_ROUTE || pathname === "/";
}

let intentionalSignOut = false;

export function resetSessionExpiryGuard(): void {
  handling = false;
  intentionalSignOut = false;
}

/**
 * Používateľ sa odhlasuje sám (alebo maže účet) — nasledujúca udalosť
 * `SIGNED_OUT` nesmie vyzerať ako vypršaná relácia.
 */
export function beginIntentionalSignOut(): void {
  intentionalSignOut = true;
}

export function isIntentionalSignOut(): boolean {
  return intentionalSignOut;
}

/** Iba oznámenie — presmerovanie si rieši router (napr. `beforeLoad`). */
export function notifySessionExpired(): void {
  if (typeof window === "undefined") return;
  if (isPublicEntryPath(window.location.pathname)) return;
  try {
    toast.error(SESSION_EXPIRED_MESSAGE);
  } catch {
    /* oznámenie nesmie nič zhodiť */
  }
}

export function handleSessionExpired(): void {
  if (typeof window === "undefined") return;
  if (handling) return;
  if (intentionalSignOut) {
    // Úmyselné odhlásenie: obrazovka si presmerovanie aj oznámenie rieši sama.
    intentionalSignOut = false;
    return;
  }
  if (isPublicEntryPath(window.location.pathname)) return;
  handling = true;
  try {
    toast.error(SESSION_EXPIRED_MESSAGE);
  } catch {
    /* oznámenie nesmie zabrániť presmerovaniu */
  }
  window.setTimeout(() => {
    window.location.replace(SIGN_IN_ROUTE);
  }, 150);
}
