import type { CaseSourceRef, ForensicCaseUnified } from "@/types/forensic-case";
import { sha256Hex } from "./export-pdf";

/** Sorted object keys, unchanged array order; never use a stored, possibly stale hash. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : item,
  );
}

export function caseSnapshotHash(data: ForensicCaseUnified): string {
  const { sha256Hash: _storedHash, ...metadata } = data.metadata;
  return sha256Hex(canonicalJson({ ...data, metadata }));
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function validSource(
  source: CaseSourceRef | undefined,
  data: ForensicCaseUnified,
): source is CaseSourceRef {
  if (!source) return false;
  const document = data.documents.find((doc) => doc.id === source.documentId);
  return (
    !!document &&
    Number.isInteger(source.page) &&
    source.page! > 0 &&
    source.page! <= document.pageCount
  );
}

export function formatCourtSource(
  source: CaseSourceRef | undefined,
  data: ForensicCaseUnified,
): string {
  if (!source) return "Zdroj nie je uvedený";
  const document = data.documents.find((doc) => doc.id === source.documentId);
  if (!document) return "Zdrojový dokument nie je dostupný";
  return `[Strana ${validSource(source, data) ? source.page : "neuvedená"}, Odsek ${source.paragraph ?? "neuvedený"}, Súbor ${document.name}]`;
}

export type EvidenceEntry = { id: string; source: CaseSourceRef; text: string };

/** Only real page + paragraph anchors may be cited. Never synthesize page numbers from previews. */
export function collectCourtEvidence(
  data: ForensicCaseUnified,
): EvidenceEntry[] {
  const entries: EvidenceEntry[] = [];
  const seen = new Set<string>();
  const add = (source: CaseSourceRef | undefined) => {
    if (
      !validSource(source, data) ||
      !source.paragraph ||
      !source.excerpt?.trim()
    )
      return;
    const doc = data.documents.find((item) => item.id === source.documentId)!;
    const passage = doc.passages?.find(
      (item) =>
        item.page === source.page && item.paragraph === source.paragraph,
    );
    // Existing, precise references can be used; when page text exists, enforce quote membership too.
    if (
      doc.passages?.length &&
      (!passage || !passage.text.includes(source.excerpt))
    )
      return;
    const key = canonicalJson(source);
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      id: `E${entries.length + 1}`,
      source,
      text: source.excerpt,
    });
  };
  for (const doc of data.documents)
    for (const passage of doc.passages ?? []) {
      add({
        documentId: doc.id,
        page: passage.page,
        paragraph: passage.paragraph,
        excerpt: passage.text,
      });
    }
  for (const row of [...data.transactions, ...data.timeline])
    add(row.sourceRef);
  return entries;
}
