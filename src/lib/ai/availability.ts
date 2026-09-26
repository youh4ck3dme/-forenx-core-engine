export type AiAvailability = {
  data?:
    | {
        configured: boolean;
        chatConfigured?: boolean;
        analysisConfigured?: boolean;
      }
    | undefined;
  isPending?: boolean;
  isLoading?: boolean;
  isError?: boolean;
};

/** Configuration is not a provider health check. Errors take precedence over stale data. */
export function aiUnavailableReason(
  status: AiAvailability,
  purpose: "chat" | "analysis",
  online: boolean,
): string | null {
  if (!online) return "AI vyžaduje internet. Obnovte pripojenie.";
  if (status.isError)
    return "Stav AI sa nepodarilo zistiť. Obnovte stav a skúste znova.";
  if (status.isPending || status.isLoading || !status.data)
    return "Zisťujem konfiguráciu Mistral AI…";
  const configured =
    purpose === "chat"
      ? status.data.chatConfigured
      : status.data.analysisConfigured;
  if (!(configured ?? status.data.configured))
    return `Mistral AI nie je nakonfigurovaná pre ${purpose === "chat" ? "rýchle úlohy" : "analýzu a OCR"} — chýba serverový API kľúč.`;
  return null;
}
