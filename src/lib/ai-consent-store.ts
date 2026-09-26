import {
  AI_CONSENT_MISSING_MESSAGE,
  AI_CONSENT_VERSION,
  assertAiConsent,
} from "./ai-consent";

export type ServerAiConsentRecord = {
  userId: string;
  caseId: string;
  consentVersion: string;
  createdAt: string;
};

const records = new Map<string, ServerAiConsentRecord>();

function consentKey(userId: string, caseId: string): string {
  return `${userId}\0${caseId}`;
}

function persist(): void {
  /* Záznam žije v pamäti serverového procesu. Trvalý zápis ide cez Supabase,
     keď je service role k dispozícii; klientsky graf sem nesmie ťahať node:fs. */
}

export function resetServerAiConsentStore(): void {
  records.clear();
}

export function rememberServerAiConsent(record: ServerAiConsentRecord): void {
  records.set(consentKey(record.userId, record.caseId), record);
  persist();
}

export function hasServerAiConsent(userId: string, caseId: string): boolean {
  const row = records.get(consentKey(userId, caseId));
  return row?.consentVersion === AI_CONSENT_VERSION;
}

/** Verzia z tela požiadavky sama endpoint neotvorí — musí existovať serverový záznam. */
export function assertServerAiConsent(input: {
  userId: string;
  caseId: string;
  consentVersion?: string | null | undefined;
}): void {
  assertAiConsent(input.consentVersion);
  if (
    !input.userId ||
    !input.caseId ||
    !hasServerAiConsent(input.userId, input.caseId)
  ) {
    throw new Error(AI_CONSENT_MISSING_MESSAGE);
  }
}
