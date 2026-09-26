export type ProcessingStage =
  "preparing" | "reading" | "uploading" | "analysing" | "saving" | "complete";

export function processingProgress({
  stage,
  elapsedSeconds,
  currentItem = 1,
  totalItems = 1,
}: {
  stage: ProcessingStage;
  elapsedSeconds: number;
  currentItem?: number;
  totalItems?: number;
}): number {
  const safeTotal = Math.max(1, totalItems);
  const safeCurrent = Math.min(Math.max(1, currentItem), safeTotal);

  if (stage === "preparing") return 4;
  if (stage === "reading" || stage === "uploading") {
    const itemBase = ((safeCurrent - 1) / safeTotal) * 68;
    const itemShare = 68 / safeTotal;
    return Math.min(72, Math.round(6 + itemBase + itemShare * 0.55));
  }
  if (stage === "analysing") {
    return Math.min(
      95,
      Math.round(72 + 23 * (1 - Math.exp(-elapsedSeconds / 40))),
    );
  }
  if (stage === "saving") return 98;
  return 100;
}

export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export const PROCESSING_COPY: Record<
  ProcessingStage,
  { title: string; detail: string }
> = {
  preparing: {
    title: "Pripravujem dokumenty",
    detail: "Kontrolujem formát a bezpečne pripravujem obsah.",
  },
  reading: {
    title: "Čítam dokument",
    detail: "Extrahujem text a rozpoznávam štruktúru spisu.",
  },
  uploading: {
    title: "Odosielam na analýzu",
    detail: "Minimalizované dáta odosielam zabezpečeným spojením.",
  },
  analysing: {
    title: "AI analyzuje súvislosti",
    detail: "Model porovnáva osoby, udalosti a väzby v spise.",
  },
  saving: {
    title: "Ukladám výsledky",
    detail: "Dopĺňam graf, časovú os a zistenia prípadu.",
  },
  complete: {
    title: "Analýza je dokončená",
    detail: "Výsledky sú uložené a pripravené na kontrolu.",
  },
};
