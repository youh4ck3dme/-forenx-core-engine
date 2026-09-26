/**
 * Súhlas s odoslaním údajov externému poskytovateľovi AI (TASK 4).
 *
 * Bez platného súhlasu neodíde do AI nič — server aj klient zlyhajú uzavreto
 * (fail-closed). Súhlas sa pamätá pre dvojicu používateľ + prípad.
 */

export const AI_CONSENT_VERSION = "2026.09-1";

export const AI_CONSENT_LABEL =
  "Potvrdzujem, že spis je minimalizovaný / mám súhlas odoslať tieto dáta.";

export const AI_CONSENT_MISSING_MESSAGE =
  "Bez potvrdeného súhlasu sa údaje do AI neodosielajú.";

export const AI_CONSENT_PREVIEW_FAILED_MESSAGE =
  "Náhľad odosielaných údajov sa nepodarilo pripraviť. Odoslanie do AI bolo zastavené.";

const PREFIX = "forenx:ai-consent";

export function aiConsentKey(userId: string, caseId: string): string {
  return `${PREFIX}:${userId || "local"}:${caseId || "none"}`;
}

export function hasAiConsent(userId: string, caseId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(aiConsentKey(userId, caseId)) ===
      AI_CONSENT_VERSION
    );
  } catch {
    return false;
  }
}

export function grantAiConsent(userId: string, caseId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      aiConsentKey(userId, caseId),
      AI_CONSENT_VERSION,
    );
  } catch {
    /* súkromný režim prehliadača — súhlas sa spýta znova */
  }
}

export function revokeAiConsent(userId: string, caseId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(aiConsentKey(userId, caseId));
  } catch {
    /* ignorujeme */
  }
}

/** Serverová kontrola — akékoľvek iné číslo verzie znamená zamietnutie. */
export function assertAiConsent(consentVersion?: string | null): void {
  if (consentVersion !== AI_CONSENT_VERSION) {
    throw new Error(AI_CONSENT_MISSING_MESSAGE);
  }
}

/** Čitateľný náhľad textu spisu, ktorý by odišiel poskytovateľovi. */
export function buildDocumentPreview(
  text: string,
  fileCount: number,
  limit = 1500,
): string {
  const body = (text ?? "").trim();
  if (!body) throw new Error(AI_CONSENT_PREVIEW_FAILED_MESSAGE);
  const head = body.length > limit ? `${body.slice(0, limit)}…` : body;
  return [
    `Počet dokumentov: ${fileCount}`,
    `Rozsah textu: ${body.length.toLocaleString("sk-SK")} znakov`,
    "",
    head,
  ].join("\n");
}

/** Náhľad pre súbory, ktoré sa ešte len budú čítať (fotografie, PDF). */
export function buildFilesPreview(
  files: { name: string; size: number }[],
): string {
  if (!files.length) throw new Error(AI_CONSENT_PREVIEW_FAILED_MESSAGE);
  return [
    `Počet súborov: ${files.length}`,
    "",
    ...files.map(
      (f) => `• ${f.name} — ${Math.max(1, Math.round(f.size / 1024))} kB`,
    ),
  ].join("\n");
}
