/**
 * Explicitné zlyhanie relácie.
 *
 * Ak v produkcii chýba alebo vyprší prihlásenie, aplikácia NIKDY nepokračuje
 * s lokálnymi (dev / demo) dátami. Vyhodí sa táto chyba, používateľ uvidí
 * oznámenie a presmerujeme ho na prihlásenie.
 */
export const SESSION_EXPIRED_MESSAGE = "Relácia vypršala. Prihláste sa znova.";

export class SessionExpiredError extends Error {
  readonly sessionExpired = true;

  constructor(message: string = SESSION_EXPIRED_MESSAGE) {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpiredError(error: unknown): boolean {
  return (
    error instanceof SessionExpiredError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { sessionExpired?: boolean }).sessionExpired === true)
  );
}
