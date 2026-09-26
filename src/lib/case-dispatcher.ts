import type {
  CaseDocument,
  CaseEntity,
  CaseRelationship,
  CaseTimelineEvent,
  CaseTransaction,
  DocumentClassification,
  ForensicCaseUnified,
} from "@/types/forensic-case";
import { ForensicCaseUnifiedSchema } from "@/types/forensic-case";
import { sha256Hex } from "@/lib/export-pdf";
import { sha256Bytes, caseSnapshotHash } from "@/lib/court-evidence";
import {
  extractCaseEntities,
  extractSingleBufferText,
} from "@/lib/ai.functions";
import { lookupCompanyWhoIsWhoProfile } from "@/lib/whoiswho.functions";
import { adaptLegacyCaseToUnified } from "@/lib/case-adapter";

export type IngestFileInput =
  | File
  | {
      name: string;
      buffer?: ArrayBuffer;
      text?: string;
      base64?: string;
      mimeType?: string;
      extractionBase64?: string;
      extractionName?: string;
    };

/**
 * 1. Deterministická regex a názvová klasifikácia typu dokumentu.
 */
export async function classifyDocument(
  sampleText: string,
  fileName = "",
): Promise<DocumentClassification> {
  const normName = fileName.toLowerCase();
  const text = sampleText.slice(0, 5000);

  // A. Názvové heuristiky
  if (
    normName.endsWith(".csv") ||
    normName.endsWith(".tsv") ||
    normName.includes("vypis") ||
    normName.includes("statement") ||
    normName.includes("transakc") ||
    normName.includes("banka") ||
    normName.includes("tatrabanka") ||
    normName.includes("vub") ||
    normName.includes("slsp")
  ) {
    if (!normName.includes("orsr") && !normName.includes("register")) {
      return "bank_statement";
    }
  }

  if (normName.includes("dimitri") || normName.includes("crossborder")) {
    return "cross_border_report";
  }

  // B. Obsahové regulárne výrazy (bankové toky)
  if (
    /(IBAN|Číslo účtu|Zostatok|Konečný zostatok|Dátum zaúčtovania|Valuta|Variabilný symbol|Konštantný symbol|Kredit|Debet|Bankové spojenie)/i.test(
      text,
    )
  ) {
    return "bank_statement";
  }

  // C. Firemné registre (ORSR, RPVS)
  if (
    /(Obchodný register|Okresný súd|Mestský súd|Oddiel:?\s*[a-z]+|Vložka číslo:?\s*\d+|Deň zápisu|Právna forma|Základné imanie)/i.test(
      text,
    )
  ) {
    return "corporate_registry";
  }

  // D. Súdne a policajné spisy
  if (
    /(ČVS:|Vyšetrovateľ|Trestný poriadok|Trestný zákon|Uznesenie o vznesení obvinenia|Zápisnica o výsluchu|Obvinen[ýáé]|Svedok|Poškoden[ýáé]|Prokurátor|ÚBOK|NAKA|Trestn[ée]ho\s*(?:poriadku|zákona))/i.test(
      text,
    )
  ) {
    return "court_dossier";
  }

  // E. Obchodné zmluvy a faktúry
  if (
    /(Zmluva o|Zmluvné strany|Predmet zmluvy|Objednávateľ|Zhotoviteľ|Kupujúci|Predávajúci|Zmluva o dielo|Faktúra č\.|Dátum splatnosti)/i.test(
      text,
    )
  ) {
    return "commercial_contract";
  }

  // F. Dimitri reporty
  if (
    /(Dimitri checker|Cross-border transfer|Foreign jurisdiction|Nominee director|Shell company alert)/i.test(
      text,
    )
  ) {
    return "cross_border_report";
  }

  // G. Všeobecný spis
  if (text.trim().length > 60) {
    return "court_dossier";
  }

  return "unknown";
}

/**
 * Parsuje bankové transakcie z textu alebo CSV formátu.
 */
function buildPassages(
  text: string,
  page: number,
): {
  page: number;
  paragraph: number;
  text: string;
}[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      page,
      paragraph: index + 1,
      text: line,
    }));
}

function extractBankTransactions(
  text: string,
  docId: string,
): {
  transactions: CaseTransaction[];
  entities: CaseEntity[];
} {
  const transactions: CaseTransaction[] = [];
  const entitiesMap = new Map<string, CaseEntity>();

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let txIndex = 0;

  for (const [lineIndex, line] of lines.entries()) {
    // Hľadanie dátumu v tvare YYYY-MM-DD alebo DD.MM.YYYY
    const dateMatch =
      line.match(/\b(\d{4}-\d{2}-\d{2})\b/) ||
      line.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
    if (!dateMatch) continue;

    let dateStr = dateMatch[0];
    if (dateMatch[3]) {
      const d = dateMatch[1]!.padStart(2, "0");
      const m = dateMatch[2]!.padStart(2, "0");
      dateStr = `${dateMatch[3]}-${m}-${d}`;
    }

    // Odstránime dátum z riadku, aby sa rok nezamenil so sumou
    const lineWithoutDate = line.replace(dateMatch[0], "");

    // Hľadanie sumy (napr. "Suma: 50 000 EUR", "50 000.00 EUR", "+1 250,50 €")
    const amountMatch =
      lineWithoutDate.match(
        /(?:suma|čiastka|obrat|amount)?[:\s]*([+-]?\s*\d{1,3}(?:[ \s]\d{3})*(?:[,.]\d{1,2})?)\s*(?:EUR|€)/i,
      ) ||
      lineWithoutDate.match(
        /(?:suma|čiastka|amount)[:\s]*([+-]?\s*\d{1,3}(?:[ \s]\d{3})*(?:[,.]\d{1,2})?)/i,
      ) ||
      lineWithoutDate.match(
        /([+-]?\s*\d{1,3}(?:[ \s]\d{3})*(?:[,.]\d{1,2})?)\s*(?:EUR|€)/i,
      );
    if (!amountMatch) continue;

    const rawNum = amountMatch[1]!.replace(/\s+/g, "").replace(",", ".");
    const amount = Math.abs(parseFloat(rawNum));
    if (isNaN(amount) || amount === 0) continue;

    // Hľadanie IBAN
    const ibanMatch = line.match(/\b([A-Z]{2}\d{2}[A-Z0-9]{12,30})\b/i);
    const iban = ibanMatch ? ibanMatch[1]!.toUpperCase() : undefined;

    // Odosielateľ a prijímateľ
    const payerName = "Vlastný účet";
    const recipientName = iban
      ? `Účet ${iban.slice(-6)}`
      : `Príjemca ${txIndex + 1}`;

    const payerId = "ent-payer-self";
    const recipientId = `ent-recip-${txIndex}`;

    if (!entitiesMap.has(payerId)) {
      entitiesMap.set(payerId, {
        id: payerId,
        name: payerName,
        kind: "company",
        role: "majiteľ účtu",
        country: "SK",
        position: { x: 120, y: 150 },
      });
    }

    if (!entitiesMap.has(recipientId)) {
      entitiesMap.set(recipientId, {
        id: recipientId,
        name: recipientName,
        kind: "company",
        role: "protistrana",
        country: iban?.startsWith("SK") ? "SK" : iban?.slice(0, 2) || "SK",
        position: { x: 380, y: 150 + (txIndex % 6) * 70 },
      });
    }

    // Detekcia anomálií
    const anomalies: string[] = [];
    if (amount >= 5000 && amount % 1000 === 0) {
      anomalies.push("round_sum");
    }
    if (/hotovos|vklad|výber|cash/i.test(line)) {
      anomalies.push("cash_deposit");
    }
    if (amount >= 100000) {
      anomalies.push("large_volume");
    }

    transactions.push({
      id: `tx-ingest-${docId}-${txIndex}`,
      documentId: docId,
      date: dateStr,
      amount,
      currency: "EUR",
      fromEntityId: payerId,
      toEntityId: recipientId,
      ibanTarget: iban,
      method: /hotovos|vklad|cash/i.test(line) ? "cash" : "transfer",
      description: line.slice(0, 160),
      anomalies,
      sourceRef: {
        documentId: docId,
        excerpt: line.slice(0, 80),
      },
    });

    txIndex++;
    if (txIndex >= 150) break; // Limit pre jeden súbor
  }

  return {
    transactions,
    entities: Array.from(entitiesMap.values()),
  };
}

/**
 * 2. Univerzálny Case Ingestion Engine & Dispečer.
 * Zabezpečuje:
 * - Výpočet SHA-256 hashu každého súboru
 * - Extrakciu textu a OCR fallback
 * - Klasifikáciu typu dokumentu
 * - Rozdelenie do entít, transakcií a časovej osi
 * - Asynchrónne spustenie WhoIsWho overenia pre IČO
 * - Automatické prepojenie hrán do grafu vzťahov
 */
export async function dispatchCaseIngest(
  caseId: string,
  files: IngestFileInput[],
  existingCase?: ForensicCaseUnified,
  onProgress?: (stage: number, fileName?: string) => void,
): Promise<{
  unifiedCase: ForensicCaseUnified;
  extractedDocuments: CaseDocument[];
  newEntities: CaseEntity[];
  newTransactions: CaseTransaction[];
  newEvents: CaseTimelineEvent[];
}> {
  const currentCase =
    existingCase ||
    adaptLegacyCaseToUnified({
      id: caseId,
      name: `Forenzný prípad ${caseId.slice(0, 8)}`,
    });

  const extractedDocuments: CaseDocument[] = [];
  if (currentCase.metadata.id !== caseId)
    throw new Error("Prípad a import sa nezhodujú.");
  const newEntities: CaseEntity[] = [];
  const newTransactions: CaseTransaction[] = [];
  const newEvents: CaseTimelineEvent[] = [];
  const newRelations: CaseRelationship[] = [];

  const entitiesByName = new Map<string, CaseEntity>();
  for (const ent of currentCase.entities) {
    entitiesByName.set(ent.name.toLowerCase().trim(), ent);
  }

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx]!;
    const fileName = "name" in file ? file.name : `subor-${fileIdx + 1}.bin`;
    const docId = `doc-${caseId.slice(0, 8)}-${fileIdx}-${Date.now().toString(36)}`;

    // A. Extrakcia textu zo súboru
    let text = "";
    let base64 = "";
    let usedOcr = false;
    let byteSize = 0;
    let pages: { page: number; text: string }[] | undefined;
    onProgress?.(1, fileName);

    if (typeof File !== "undefined" && file instanceof File) {
      byteSize = file.size;
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      base64 = btoa(binary);

      const extRes = await extractSingleBufferText(fileName, base64);
      text = extRes.text;
      usedOcr = extRes.usedOcr ?? false;
      pages = extRes.pages;
    } else {
      const obj = file as {
        name: string;
        buffer?: ArrayBuffer;
        text?: string;
        base64?: string;
        mimeType?: string;
        extractionBase64?: string;
        extractionName?: string;
      };
      if (obj.text) {
        text = obj.text;
        byteSize = obj.text.length;
      } else if (obj.base64) {
        base64 = obj.base64;
        const extRes = await extractSingleBufferText(
          obj.extractionName ?? fileName,
          obj.extractionBase64 ?? base64,
        );
        text = extRes.text;
        usedOcr = extRes.usedOcr ?? false;
        pages = extRes.pages;
        byteSize = base64.length;
      } else if (obj.buffer) {
        byteSize = obj.buffer.byteLength;
        const bytes = new Uint8Array(obj.buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        base64 = btoa(binary);
        const extRes = await extractSingleBufferText(fileName, base64);
        text = extRes.text;
        usedOcr = extRes.usedOcr ?? false;
        pages = extRes.pages;
      }
    }

    onProgress?.(0, fileName);
    const originalBytes = base64
      ? Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      : new TextEncoder().encode(text);
    const fileSha256 = await sha256Bytes(originalBytes);
    byteSize = originalBytes.byteLength;
    if (text.length > 750_000)
      throw new Error(
        "Text dokumentu presahuje limit importu. Rozdeľte ho na časti.",
      );
    if (!pages && /\.(png|jpe?g|heic)$/i.test(fileName))
      pages = [{ page: 1, text }];
    onProgress?.(2, fileName);

    let storagePath: string | undefined;
    if (base64) {
      const { isS3StorageConfigured, uploadDocumentToS3 } =
        await import("./storage/s3.server");
      if (isS3StorageConfigured()) {
        storagePath = await uploadDocumentToS3(
          caseId,
          docId,
          fileName,
          Buffer.from(originalBytes),
          fileName.endsWith(".pdf")
            ? "application/pdf"
            : fileName.endsWith(".csv")
              ? "text/csv"
              : "application/octet-stream",
          fileSha256,
        );
      }
    }

    // B. Klasifikácia dokumentu
    const classification = await classifyDocument(text, fileName);

    const docMeta: CaseDocument = {
      id: docId,
      name: fileName,
      size: byteSize,
      mimeType: fileName.endsWith(".pdf")
        ? "application/pdf"
        : fileName.endsWith(".csv")
          ? "text/csv"
          : "application/octet-stream",
      sha256: fileSha256,
      classification,
      ocrStatus: usedOcr ? "completed" : "none",
      usedOcr,
      pageCount: pages?.length ?? 0,
      rawTextPreview: text.slice(0, 1500),
      extractedText: text,
      hashBasis: base64
        ? "file_bytes"
        : text
          ? "extracted_text"
          : "legacy_unknown",
      ...(storagePath ? { storagePath } : {}),
      passages:
        pages?.flatMap((page) => buildPassages(page.text, page.page)) ?? [],
      uploadedAt: new Date().toISOString(),
    };
    extractedDocuments.push(docMeta);

    // C. Štruktúrovaná extrakcia podľa typu dokumentu
    if (classification === "bank_statement") {
      const bankData = extractBankTransactions(text, docId);
      for (const t of bankData.transactions) {
        const matching =
          docMeta.passages?.filter(
            (passage) =>
              t.sourceRef?.excerpt &&
              passage.text.includes(t.sourceRef.excerpt),
          ) ?? [];
        if (matching.length === 1 && t.sourceRef)
          t.sourceRef = {
            ...t.sourceRef,
            page: matching[0]!.page,
            paragraph: matching[0]!.paragraph,
          };
        newTransactions.push(t);
      }
      for (const e of bankData.entities) {
        const key = e.name.toLowerCase().trim();
        if (!entitiesByName.has(key)) {
          entitiesByName.set(key, e);
          newEntities.push(e);
        }
      }
    } else {
      // Súdny spis, zmluva, alebo register
      const parsedCase = extractCaseEntities(text);

      // Subjekty
      for (const p of parsedCase.entities.persons) {
        const key = p.name.toLowerCase().trim();
        if (!entitiesByName.has(key)) {
          const entity: CaseEntity = {
            id: `ent-person-${docId}-${newEntities.length}`,
            name: p.name,
            kind: "person",
            role: p.role || "osoba",
            country: "SK",
            position: {
              x: 100 + (entitiesByName.size % 4) * 160,
              y: 100 + Math.floor(entitiesByName.size / 4) * 120,
            },
          };
          entitiesByName.set(key, entity);
          newEntities.push(entity);
        }
      }

      const allCompanies = new Set<string>(parsedCase.entities.companies);

      // Regex hľadanie firiem podľa právnej formy (s.r.o., a.s., atď.)
      const legalFormMatches = text.matchAll(
        /\b([A-ZÁ-Ž0-9][A-ZÁ-Ž0-9\s.-]{1,35}?\s+(?:s\.r\.o\.|a\.s\.|k\.s\.|v\.o\.s\.|spol\.\s*s\s*r\.o\.))\b/gi,
      );
      for (const m of legalFormMatches) {
        if (m[1]) allCompanies.add(m[1].trim());
      }

      // Regex hľadanie firiem priamo s IČO
      const icoPatternMatches = text.matchAll(
        /(?:spoločnosť|firma)?\s*([A-ZÁ-Ž0-9][A-ZÁ-Ž0-9\s.-]{1,35}?)\s*(?:\([^)]*\))?\s*\(?(?:IČO|ico)[:\s]+(\d{8})\)?/gi,
      );
      for (const m of icoPatternMatches) {
        if (m[1]) allCompanies.add(m[1].trim());
      }

      for (const c of allCompanies) {
        const key = c.toLowerCase().trim();
        if (!entitiesByName.has(key)) {
          // Hľadanie IČO pri názve firmy (8 číslic)
          const icoMatch =
            text.match(new RegExp(`${c}[^\\d]{0,40}(\\d{8})`, "i")) ||
            text.match(new RegExp(`(\\d{8})[^\\d]{0,40}${c}`, "i")) ||
            text.match(/\b(\d{8})\b/);
          const ico = icoMatch ? icoMatch[1] : undefined;

          const entity: CaseEntity = {
            id: `ent-comp-${docId}-${newEntities.length}`,
            name: c,
            kind: "company",
            role: "spoločnosť",
            ico,
            country: "SK",
            position: {
              x: 100 + (entitiesByName.size % 4) * 160,
              y: 100 + Math.floor(entitiesByName.size / 4) * 120,
            },
            intelligence: ico
              ? {
                  verified: false,
                  source: "whoiswho_sk",
                  riskScore: 0,
                  isShellCompany: false,
                  taxDebtor: false,
                  inBankruptcy: false,
                  inRestructuring: false,
                }
              : undefined,
          };
          entitiesByName.set(key, entity);
          newEntities.push(entity);
        }
      }

      // Časová os a udalosti
      if (parsedCase.metadata.date) {
        newEvents.push({
          id: `ev-${docId}-1`,
          timestamp: parsedCase.metadata.date,
          title: `Záznam zo spisu: ${fileName}`,
          detail: `Dokument typu: ${parsedCase.metadata.documentType || classification}. Miesto: ${parsedCase.metadata.location || "SR"}.`,
          severity: "medium",
          paragraph: parsedCase.entities.legalParagraphs[0],
          involvedEntityIds: newEntities.map((e) => e.id),
          chainBreak: false,
          sourceRef: {
            documentId: docId,
            excerpt: text.slice(0, 120),
          },
        });
      }
    }
  }

  // D. Asynchrónne spustenie WhoIsWho overenia pre nájdené IČO
  onProgress?.(3);
  const entitiesWithIco = newEntities.filter(
    (e) => e.ico && e.ico.trim().length === 8,
  );
  if (entitiesWithIco.length > 0) {
    await Promise.allSettled(
      entitiesWithIco.map(async (entity) => {
        try {
          const profileData = await lookupCompanyWhoIsWhoProfile(entity.ico!);
          if (profileData && profileData.profile) {
            const riskData = profileData.risk?.data;
            const flags = riskData?.flags ?? [];
            const hasTaxDebt = flags.some((f) => {
              const code = typeof f === "string" ? f : f.code;
              return /tax|debt|nedoplatok/i.test(code);
            });
            const hasBankruptcy = flags.some((f) => {
              const code = typeof f === "string" ? f : f.code;
              return /bankruptcy|konkurz|insolv/i.test(code);
            });

            entity.intelligence = {
              verified: true,
              source: "whoiswho_sk",
              riskScore: riskData?.score ?? 0,
              isShellCompany: (riskData?.score ?? 0) >= 60,
              taxDebtor: hasTaxDebt,
              inBankruptcy: hasBankruptcy,
              inRestructuring: false,
              lastCheckedAt: new Date().toISOString(),
            };
          }
        } catch {
          // WhoIsWho offline / nedostupné -> bezpečný fallback
        }
      }),
    );
  }

  // E. Prepojenie hrán do grafu väzieb (Relationships)
  onProgress?.(4);
  for (const tx of newTransactions) {
    newRelations.push({
      id: `rel-tx-${tx.id}`,
      fromEntityId: tx.fromEntityId,
      toEntityId: tx.toEntityId,
      type: "money_flow",
      label: `${tx.amount.toLocaleString("sk-SK")} €`,
      weight: Math.min(5, Math.max(1, Math.round(tx.amount / 10000))),
      sourceRef: tx.sourceRef?.documentId,
    });
  }

  // Prepojenie osôb v rovnakom spise
  if (newEntities.length >= 2) {
    for (let i = 0; i < newEntities.length - 1; i++) {
      const e1 = newEntities[i]!;
      const e2 = newEntities[i + 1]!;
      if (e1.kind !== e2.kind) {
        newRelations.push({
          id: `rel-link-${e1.id}-${e2.id}`,
          fromEntityId: e1.id,
          toEntityId: e2.id,
          type: "common_event",
          label: "Spoločný výskyt v importe (nie preukázaná právna väzba)",
          weight: 1,
        });
      }
    }
  }

  // F. Zlúčenie do unifikovaného modelu ForensicCaseUnified
  const mergedDocuments = [...currentCase.documents, ...extractedDocuments];
  const mergedEntities = [...currentCase.entities, ...newEntities];
  const mergedTransactions = [...currentCase.transactions, ...newTransactions];
  const mergedRelationships = [...currentCase.relationships, ...newRelations];
  const mergedTimeline = [...currentCase.timeline, ...newEvents];

  const payloadToHash = JSON.stringify({
    id: currentCase.metadata.id,
    entities: mergedEntities.length,
    transactions: mergedTransactions.length,
    documents: mergedDocuments.length,
  });
  const updatedSha256 = sha256Hex(payloadToHash);

  const updatedUnifiedCase: ForensicCaseUnified = {
    ...currentCase,
    metadata: {
      ...currentCase.metadata,
      updatedAt: new Date().toISOString(),
      sha256Hash: updatedSha256,
      status:
        mergedEntities.length > 0 || mergedTransactions.length > 0
          ? "analyzed"
          : "draft",
    },
    documents: mergedDocuments,
    entities: mergedEntities,
    transactions: mergedTransactions,
    relationships: mergedRelationships,
    timeline: mergedTimeline,
  };

  updatedUnifiedCase.metadata.sha256Hash = caseSnapshotHash(updatedUnifiedCase);
  return {
    unifiedCase: ForensicCaseUnifiedSchema.parse(updatedUnifiedCase),
    extractedDocuments,
    newEntities,
    newTransactions,
    newEvents,
  };
}
