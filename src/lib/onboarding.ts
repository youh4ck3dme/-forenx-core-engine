/**
 * Jediné miesto, ktoré rozhoduje, kam patrí používateľ po vstupe.
 *
 * Poradie krokov: úvod (1) → heslo (2) → profil (3) → nový prípad (4)
 * → sandbox so spismi (5) → prehľad.
 */

export const ONBOARDING_STEPS = 5;

export type OnboardingInput = {
  /** Je profil vyplnený a označený ako dokončený? */
  profileCompleted: boolean;
  /** Počet prípadov používateľa. */
  caseCount: number;
  /** Nastane, ak sa profil alebo prípady nepodarilo načítať. */
  loadFailed?: boolean;
  /** Preskočil používateľ profil v tejto relácii? */
  profileSkipped?: boolean;
};

export type OnboardingDecision =
  | { kind: "error" }
  | { kind: "profile"; to: "/profil" }
  | { kind: "new-case"; to: "/pripady" }
  | { kind: "overview"; to: "/prehlad" };

/**
 * Čítanie dát zlyhalo → chyba so zopakovaním, nikdy nie „žiadne prípady“.
 */
export function decideNextStep(input: OnboardingInput): OnboardingDecision {
  if (input.loadFailed) return { kind: "error" };
  if (!input.profileCompleted && !input.profileSkipped) {
    return { kind: "profile", to: "/profil" };
  }
  if (input.caseCount === 0) return { kind: "new-case", to: "/pripady" };
  return { kind: "overview", to: "/prehlad" };
}

/* --- preskočenie profilu: platí len pre reláciu a konkrétny účet --- */

const SKIP_PREFIX = "forenx:profile-skip:";

function skipKey(accountKey: string): string {
  return `${SKIP_PREFIX}${accountKey}`;
}

export function isProfileSkipped(accountKey: string | null): boolean {
  if (typeof window === "undefined" || !accountKey) return false;
  try {
    return window.sessionStorage.getItem(skipKey(accountKey)) === "true";
  } catch {
    return false;
  }
}

export function setProfileSkipped(accountKey: string | null): void {
  if (typeof window === "undefined" || !accountKey) return;
  try {
    window.sessionStorage.setItem(skipKey(accountKey), "true");
  } catch {
    /* prázdne */
  }
}

export function clearProfileSkip(accountKey: string | null): void {
  if (typeof window === "undefined" || !accountKey) return;
  try {
    window.sessionStorage.removeItem(skipKey(accountKey));
  } catch {
    /* prázdne */
  }
}
