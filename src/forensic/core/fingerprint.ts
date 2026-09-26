import type { ForensicCase } from "../types";

/**
 * Deterministický odtlačok analyzovaných dát.
 * Zámerne ignoruje rozloženie grafu (x, y) a čas vytvorenia reportu —
 * tie nesmú ovplyvniť reprodukovateľnosť výsledku.
 */
export function dataFingerprint(input: ForensicCase): string {
  const normalized = {
    id: input.id,
    referenceDate: input.referenceDate,
    baseCurrency: input.baseCurrency,
    entities: [...input.entities]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((e) => [
        e.id,
        e.name,
        e.kind,
        e.role,
        e.ico ?? "",
        e.country,
        e.licence ?? "",
      ]),
    transactions: [...input.transactions]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => [
        t.id,
        t.date,
        t.amount,
        t.currency,
        t.method,
        t.fromId,
        t.toId,
        t.payerId ?? "",
        t.description,
      ]),
    weapons: [...input.weapons]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((w) => [
        w.id,
        w.serial,
        w.holderId,
        w.supplierId,
        w.acquiredAt,
        w.licence ?? "",
      ]),
    relations: [...input.relations]
      .map((r) => [r.fromId, r.toId, r.label])
      .sort(),
    events: [...input.events].map((e) => [e.date, e.title, e.severity]).sort(),
  };

  const text = JSON.stringify(normalized);
  // FNV-1a (32-bit) v dvoch posunutých behoch — krátky, stabilný a bez závislostí.
  const hash = (seed: number) => {
    let h = seed;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return `${hash(0x811c9dc5)}${hash(0x9e3779b9)}`;
}
