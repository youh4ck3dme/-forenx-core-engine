import type { CaseSourceRef, ForensicCaseUnified } from "@/types/forensic-case";
import { validSource } from "@/lib/court-evidence";

const INJECTION =
  /ignoruj\s+všetky\s+predch|ignore\s+all\s+previous|subjekt\s+je\s+nevinn|\bje\s+nevinný\b/i;

function collectRefs(value: unknown, out: CaseSourceRef[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, out);
    return;
  }
  const record = value as Record<string, unknown>;
  const ref = record["sourceRef"];
  if (ref && typeof ref === "object" && !Array.isArray(ref)) {
    const source = ref as CaseSourceRef;
    if (typeof source.documentId === "string") out.push(source);
  }
  for (const item of Object.values(record)) collectRefs(item, out);
}

/**
 * Záver o nevine alebo pokyn z textu spisu bez platného sourceRef sa zahodí.
 * Dokumenty sú len id + pageCount — validSource iné polia nečíta.
 */
export function assertNoInjectedVerdict(
  dossier: unknown,
  documents: { id: string; pageCount: number }[],
): void {
  const text = JSON.stringify(dossier) ?? "";
  if (!INJECTION.test(text)) return;
  const refs: CaseSourceRef[] = [];
  collectRefs(dossier, refs);
  const carrier = {
    documents: documents.map((doc) => ({
      id: doc.id,
      pageCount: doc.pageCount,
    })),
  } as ForensicCaseUnified;
  const backed = refs.some((ref) => validSource(ref, carrier));
  if (!backed) {
    throw new Error(
      "Model vrátil záver bez platného zdrojového odkazu. Výstup bol odmietnutý.",
    );
  }
}
