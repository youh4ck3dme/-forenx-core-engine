import type { ForensicCaseUnified } from "@/types/forensic-case";

/** Same deterministic redaction on client preview, server request and PDF, including free text. */
export function createCaseRedactor(data: ForensicCaseUnified) {
  const replacements = new Map<string, string>();
  const register = (value: string | undefined, replacement: string) => {
    if (value?.trim()) replacements.set(value.normalize("NFC"), replacement);
  };
  register(data.metadata.name, "Prípad");
  register(data.metadata.id, "PRIPAD");
  register(data.metadata.userId, "POUZIVATEL");
  data.entities.forEach((item, i) => {
    const alias = `S${i + 1}`;
    register(item.name, alias);
    register(item.id, alias);
    register(item.ico, "[IČO]");
    register(item.address, "[ADRESA]");
    if (item.kind === "person")
      for (const part of item.name.split(/\s+/)) {
        if (part.length >= 3) register(part, alias);
      }
  });
  data.documents.forEach((item, i) => {
    register(item.name, `Dokument D${i + 1}`);
    register(item.id, `D${i + 1}`);
    register(item.storagePath, "[ÚLOŽISKO]");
  });
  data.transactions.forEach((item, i) => {
    register(item.id, `T${i + 1}`);
    register(item.ibanSource, "[IBAN]");
    register(item.ibanTarget, "[IBAN]");
  });
  data.relationships.forEach((item, i) => register(item.id, `V${i + 1}`));
  data.timeline.forEach((item, i) => register(item.id, `U${i + 1}`));
  const entries = [...replacements.entries()].sort(
    ([a], [b]) => b.length - a.length,
  );
  const pattern = entries.length
    ? new RegExp(
        entries
          .map(([value]) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|"),
        "giu",
      )
    : null;
  const aliases = new Map(
    entries.map(([key, value]) => [key.toLocaleLowerCase("sk"), value]),
  );
  return (input: string): string => {
    let text = input.normalize("NFC");
    if (pattern)
      text = text.replace(
        pattern,
        (value) => aliases.get(value.toLocaleLowerCase("sk")) ?? "[ÚDAJ]",
      );
    return text
      .replace(/\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){11,30}\b/gi, "[IBAN]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
      .replace(/\b\d{6}\s*\/\s*\d{3,4}\b/g, "[RODNÉ ČÍSLO]")
      .replace(/(?:\+\d{1,3}[ -]?)?(?:0|\+)[\d ()-]{8,16}\d\b/g, "[TELEFÓN]")
      .replace(/https?:\/\/[^\s"<>]+/gi, "[ODKAZ]");
  };
}

export function redactUnifiedCase(
  data: ForensicCaseUnified,
): ForensicCaseUnified {
  const redact = createCaseRedactor(data);
  // Traverse values, not serialized JSON: quotes and backslashes cannot corrupt the structure.
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") return redact(value);
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, visit(item)]),
      );
    return value;
  };
  const safe = visit(data) as ForensicCaseUnified;
  // Hashes are opaque integrity values, not text to pattern-match.
  safe.metadata.sha256Hash = data.metadata.sha256Hash;
  safe.documents.forEach((doc, i) => {
    doc.sha256 = data.documents[i]!.sha256;
    delete doc.storagePath;
  });
  safe.entities.forEach((entity) => {
    delete entity.address;
    delete entity.ico;
    if (entity.intelligence) delete entity.intelligence.ddReportUrl;
  });
  return safe;
}
