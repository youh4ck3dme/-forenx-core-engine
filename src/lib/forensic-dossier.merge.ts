/**
 * Zlúčenie čiastkových dossierov z viacerých častí rozsiahleho spisu.
 * Každá časť sa analyzuje samostatným volaním AI (kratšie, nepadá na limite),
 * výsledky sa spoja do jedného dossieru.
 */
import type { ParsedForensicDossier } from "./forensic-dossier.schema";

type Loose = Record<string, unknown>;

function asArray(value: unknown): Loose[] {
  return Array.isArray(value) ? (value as Loose[]) : [];
}

/** Odstráni duplicity podľa serializovaného obsahu položky. */
function dedupe(items: Loose[]): Loose[] {
  const seen = new Set<string>();
  const out: Loose[] = [];
  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function mergeJudgeText(parts: ParsedForensicDossier[]): string | Loose {
  const texts: string[] = [];
  const objects: Loose[] = [];
  for (const part of parts) {
    const value = part.judgeReadyText;
    if (typeof value === "string") {
      if (value.trim()) texts.push(value.trim());
    } else if (value && typeof value === "object") {
      objects.push(value as Loose);
    }
  }
  if (objects.length > 0) {
    const merged: Loose = {};
    for (const obj of objects) {
      for (const [key, value] of Object.entries(obj)) {
        const existing = merged[key];
        if (typeof existing === "string" && typeof value === "string") {
          merged[key] = existing.includes(value)
            ? existing
            : `${existing}\n\n${value}`;
        } else if (Array.isArray(existing) && Array.isArray(value)) {
          merged[key] = dedupe([...existing, ...value] as Loose[]);
        } else if (existing === undefined) {
          merged[key] = value;
        }
      }
    }
    if (texts.length > 0) merged["summary"] = texts.join("\n\n");
    return merged;
  }
  return texts.join("\n\n");
}

const RISK_ORDER = ["NÍZKE", "STREDNÉ", "VYSOKÉ", "KRITICKÉ"];

function highestRisk(parts: ParsedForensicDossier[]): string | undefined {
  let best: string | undefined;
  let bestIndex = -1;
  for (const part of parts) {
    const risk = part.defenseAttack?.overallRisk;
    if (typeof risk !== "string") continue;
    const index = RISK_ORDER.indexOf(risk.toUpperCase());
    if (index > bestIndex) {
      bestIndex = index;
      best = risk;
    }
    if (bestIndex === -1 && !best) best = risk;
  }
  return best;
}

export function mergeForensicDossiers(
  parts: ParsedForensicDossier[],
): ParsedForensicDossier {
  if (parts.length === 0) throw new Error("Chýbajú čiastkové výsledky AI.");
  if (parts.length === 1) return parts[0]!;

  const indexes = parts
    .map((p) => p.defendabilityIndex)
    .filter((v): v is number => typeof v === "number");

  const merged: ParsedForensicDossier = {
    ...parts[0]!,
    facts: {
      timeline: dedupe(parts.flatMap((p) => asArray(p.facts?.timeline))),
      traces: dedupe(parts.flatMap((p) => asArray(p.facts?.traces))),
    },
    defenseAttack: {
      ...(highestRisk(parts) ? { overallRisk: highestRisk(parts)! } : {}),
      attacks: dedupe(parts.flatMap((p) => asArray(p.defenseAttack?.attacks))),
    },
    evidenceStrength: {
      traces: dedupe(parts.flatMap((p) => asArray(p.evidenceStrength?.traces))),
      paragraphs: dedupe(
        parts.flatMap((p) => asArray(p.evidenceStrength?.paragraphs)),
      ),
    },
    judgeReadyText: mergeJudgeText(parts),
  };

  if (indexes.length > 0) {
    merged.defendabilityIndex = Math.round(
      indexes.reduce((a, b) => a + b, 0) / indexes.length,
    );
  }
  return merged;
}
