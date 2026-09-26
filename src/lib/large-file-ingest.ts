import type {
  CaseEntity,
  CaseTransaction,
  ForensicCaseUnified,
} from "@/types/forensic-case";

/** Jeden súbor v prehliadači aj na serveri. */
export const MAX_FILE_SIZE = 150 * 1024 * 1024;
/** Viac súborov naraz. */
export const MAX_BATCH_BYTES = 300 * 1024 * 1024;
/** Telo požiadavky Nitro / Nginx / worker. */
export const MAX_BODY_BYTES = 260 * 1024 * 1024;
/** Jedna dávka Autopilota: 10–15 normostrán. */
export const PAGES_PER_CHUNK = 12;

export type PdfPageText = { page: number; text: string };

export type PdfTextChunk = {
  startPage: number;
  endPage: number;
  totalPages: number;
  text: string;
};

export function validateUploadSelection(
  files: { name: string; size: number }[],
): { ok: true } | { ok: false; message: string } {
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_BATCH_BYTES) {
    return {
      ok: false,
      message: `Výber má ${(total / (1024 * 1024)).toFixed(0)} MB. Naraz je možné nahrať ${MAX_BATCH_BYTES / (1024 * 1024)} MB.`,
    };
  }
  const over = files.find((file) => file.size > MAX_FILE_SIZE);
  if (over) {
    return {
      ok: false,
      message: `Súbor „${over.name}" má ${(over.size / (1024 * 1024)).toFixed(0)} MB. Maximum je ${MAX_FILE_SIZE / (1024 * 1024)} MB. Väčší spis systém spracuje po stranách, tento súbor je nad stropom.`,
    };
  }
  return { ok: true };
}

/** Rozdelí strany PDF do dávok. Text strán sa nestráca. */
export function chunkPdfPages(
  pages: PdfPageText[],
  pagesPerChunk = PAGES_PER_CHUNK,
): PdfTextChunk[] {
  const ordered = [...pages].sort((a, b) => a.page - b.page);
  if (ordered.length === 0) return [];
  const size = Math.max(1, pagesPerChunk);
  const totalPages = ordered.length;
  const chunks: PdfTextChunk[] = [];
  for (let index = 0; index < ordered.length; index += size) {
    const slice = ordered.slice(index, index + size);
    chunks.push({
      startPage: slice[0]!.page,
      endPage: slice[slice.length - 1]!.page,
      totalPages,
      text: slice
        .map((page) => page.text.trim())
        .filter(Boolean)
        .join("\n\n"),
    });
  }
  return chunks;
}

export function chunkProgressMessage(chunk: PdfTextChunk): string {
  return `Spracovávam strany ${chunk.startPage}–${chunk.endPage} z ${chunk.totalPages}... Extrahujem subjekty...`;
}

function entityKey(entity: CaseEntity): string {
  return `${entity.kind}:${entity.name.trim().toLowerCase()}`;
}

function transactionKey(tx: CaseTransaction): string {
  return [
    tx.id,
    tx.date,
    tx.amount,
    tx.fromEntityId,
    tx.toEntityId,
    tx.description,
  ].join("|");
}

/** Zlúči dávky do jedného prípadu. Rovnaká entita ostane raz, unikátne transakcie všetky. */
export function mergeIngestBatches(
  base: ForensicCaseUnified,
  batches: { entities: CaseEntity[]; transactions: CaseTransaction[] }[],
): ForensicCaseUnified {
  const entities = [...base.entities];
  const seenEntities = new Set(entities.map(entityKey));
  const transactions = [...base.transactions];
  const seenTransactions = new Set(transactions.map(transactionKey));

  for (const batch of batches) {
    for (const entity of batch.entities) {
      const key = entityKey(entity);
      if (seenEntities.has(key)) continue;
      seenEntities.add(key);
      entities.push(entity);
    }
    for (const tx of batch.transactions) {
      const key = transactionKey(tx);
      if (seenTransactions.has(key)) continue;
      seenTransactions.add(key);
      transactions.push(tx);
    }
  }

  return {
    ...base,
    entities,
    transactions,
  };
}
