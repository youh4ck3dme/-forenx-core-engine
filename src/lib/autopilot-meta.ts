/**
 * Proveniencia Forenzného Autopilota — idempotency, truncácia, source refs.
 */
import { PROMPT_VERSION } from "@/lib/ai/redact";
import {
  AUTOPILOT_CHUNK_CHARS,
  AUTOPILOT_DOCUMENT_CHAR_LIMIT,
} from "@/lib/ai-prompt";
import type {
  AutopilotAnalysisMeta,
  AutopilotChunkMeta,
  ForensicDossier,
} from "@/lib/types";
import { formatSourceRef } from "@/lib/types";

export { PROMPT_VERSION };

const HEURISTIC_NOTE =
  "registryAnalysis / crossBorderAnalysis sú AI odhady z textu spisu — nie live ORSR, RPVS ani Dimitri API.";

/** Stabilný kľúč: rovnaký spis + prompt → rovnaká analýza (prepíše predchádzajúcu). */
export async function buildAutopilotIdempotencyKey(input: {
  caseId: string;
  documentText: string;
  promptVersion?: string;
}): Promise<string> {
  const version = input.promptVersion ?? PROMPT_VERSION;
  const payload = `${input.caseId}|${version}|${input.documentText.length}|${fnv1a(input.documentText)}`;
  return `ap:${payload}`;
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function collectSourceReferences(dossier: ForensicDossier): string[] {
  const refs = new Set<string>();
  for (const ev of dossier.facts?.timeline ?? []) {
    const formatted = formatSourceRef(ev.sourceRef) || ev.source?.trim();
    if (formatted) refs.add(formatted);
  }
  for (const t of dossier.facts?.traces ?? []) {
    const formatted = formatSourceRef(t.sourceRef) || t.paragraph?.trim();
    if (formatted) refs.add(formatted);
  }
  for (const a of dossier.defenseAttack?.attacks ?? []) {
    const formatted = formatSourceRef(a.sourceRef) || a.paragraph?.trim();
    if (formatted) refs.add(formatted);
  }
  for (const e of dossier.evidenceStrength?.traces ?? []) {
    const formatted = formatSourceRef(e.sourceRef) || e.paragraph?.trim();
    if (formatted) refs.add(formatted);
  }
  return Array.from(refs).slice(0, 80);
}

export function buildAnalysisMeta(input: {
  caseId: string;
  documentIds: string[];
  inputChars: number;
  analyzedChars: number;
  chunkCount: number;
  chunks: AutopilotChunkMeta[];
  model: string;
  provider?: string;
  idempotencyKey: string;
  analysisStatus: AutopilotAnalysisMeta["analysisStatus"];
  sourceReferences: string[];
  isDemo?: boolean;
}): AutopilotAnalysisMeta {
  const truncated =
    input.inputChars > AUTOPILOT_DOCUMENT_CHAR_LIMIT ||
    input.chunkCount > 1 ||
    input.analyzedChars < input.inputChars;
  return {
    promptVersion: PROMPT_VERSION,
    model: input.model,
    ...(input.provider ? { provider: input.provider } : {}),
    createdAt: new Date().toISOString(),
    analysisStatus: input.analysisStatus,
    documentIds: input.documentIds,
    sourceReferences: input.sourceReferences,
    idempotencyKey: input.idempotencyKey,
    truncation: {
      inputChars: input.inputChars,
      analyzedChars: input.analyzedChars,
      truncated,
      chunkCount: input.chunkCount,
      chunkLimit: AUTOPILOT_CHUNK_CHARS,
      documentLimit: AUTOPILOT_DOCUMENT_CHAR_LIMIT,
    },
    chunks: input.chunks,
    ...(input.isDemo ? { isDemo: true } : {}),
    heuristicModulesNote: HEURISTIC_NOTE,
  };
}

export function attachAnalysisMeta(
  dossier: ForensicDossier,
  meta: AutopilotAnalysisMeta,
): ForensicDossier {
  return {
    ...dossier,
    generatedAt: meta.createdAt,
    analysisMeta: meta,
  };
}

export function isDemoDossier(dossier: ForensicDossier | null): boolean {
  if (!dossier) return false;
  return (
    dossier.analysisMeta?.isDemo === true ||
    dossier.analysisMeta?.analysisStatus === "demo"
  );
}
