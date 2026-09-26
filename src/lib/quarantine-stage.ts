/** Client-side staging z admin quarantine panelu → Sandbox / Autopilot. */

export const QUARANTINE_STAGE_KEY = "forenx:quarantine-stage";

export type QuarantineStageTarget = "sandbox" | "asistent";

export type QuarantineStagePayload = {
  caseId: string;
  names: string[];
  target: QuarantineStageTarget;
  createdAt: number;
};

export function writeQuarantineStage(payload: QuarantineStagePayload): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(QUARANTINE_STAGE_KEY, JSON.stringify(payload));
}

export function readQuarantineStage(): QuarantineStagePayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(QUARANTINE_STAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuarantineStagePayload;
    if (
      !parsed ||
      typeof parsed.caseId !== "string" ||
      !Array.isArray(parsed.names) ||
      (parsed.target !== "sandbox" && parsed.target !== "asistent")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearQuarantineStage(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(QUARANTINE_STAGE_KEY);
}

/** base64 → File pre existujúce upload pipeline. */
export function quarantineBase64ToFile(
  fileName: string,
  mime: string,
  base64: string,
): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mime });
}
