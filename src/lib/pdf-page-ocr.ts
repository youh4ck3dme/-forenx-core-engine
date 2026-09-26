/**
 * Client-side rasterizácia skenovaných / veľkých PDF na JPEG stránky
 * pod Vercel-safe budget, potom OCR cez existujúci image path.
 */

import {
  PDF_PAGES_PER_CHUNK,
  SAFE_SERVER_FN_BYTES,
  encodeBase64,
  toUploadPayload,
  type UploadPayload,
} from "@/lib/upload-prep";

export const PDF_PAGE_OCR_SEPARATOR = (n: number) => `--- strana ${n} ---`;

export const PDF_SCAN_OCR_TOAST =
  "PDF nemá textovú vrstvu alebo je veľký (sken/fotka). Spracujem ho automaticky po dávkach stránok…";

const JPEG_QUALITY = 0.7;
const MAX_EDGE = 1600;

export type PdfPagePayload = {
  fileName: string;
  fileBase64: string;
  page: number;
};

/** Spojí OCR texty stránok s oddeľovačmi. */
export function joinOcrPageTexts(
  pages: { page: number; text: string }[],
): string {
  return pages
    .slice()
    .sort((a, b) => a.page - b.page)
    .map((p) => `${PDF_PAGE_OCR_SEPARATOR(p.page)}\n${p.text.trim()}`)
    .filter((block) => block.length > PDF_PAGE_OCR_SEPARATOR(1).length + 1)
    .join("\n\n");
}

/**
 * Rasterizuje PDF stránky cez pdf.js → JPEG (pod SAFE_SERVER_FN_BYTES).
 * Beží len v prehliadači (canvas).
 */
export async function prepareScannedPdfPages(
  file: File,
): Promise<PdfPagePayload[]> {
  if (typeof window === "undefined") {
    throw new Error("Rasterizácia PDF je dostupná len v prehliadači.");
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Stránkový OCR je len pre PDF súbory.");
  }

  // Worker z same-origin (Vite ?url) — CSP zakazuje cdn.jsdelivr.net.
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
    .default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const baseName = file.name.replace(/\.pdf$/i, "");
  const out: PdfPagePayload[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(
      1.5,
      MAX_EDGE / Math.max(unscaled.width, unscaled.height),
    );
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D nie je dostupný.");

    await page.render({ canvasContext: ctx, viewport }).promise;

    let quality = JPEG_QUALITY;
    let blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    while (blob && blob.size > SAFE_SERVER_FN_BYTES && quality > 0.35) {
      quality -= 0.1;
      blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
    }
    if (!blob || blob.size === 0) {
      throw new Error(`Nepodarilo sa rasterizovať stranu ${pageNum}.`);
    }
    if (blob.size > SAFE_SERVER_FN_BYTES) {
      throw new Error(
        `Strana ${pageNum} je aj po kompresii príliš veľká na upload. Skúste nižšie rozlíšenie skenu.`,
      );
    }

    const buffer = await blob.arrayBuffer();
    out.push({
      fileName: `${baseName}.p${pageNum}.jpg`,
      fileBase64: await encodeBase64(buffer),
      page: pageNum,
    });

    canvas.width = 0;
    canvas.height = 0;
  }

  return out;
}

type PdfExtractionResponse = {
  results?: Array<{
    fileName: string;
    success: boolean;
    text?: string | undefined;
    error?: string | undefined;
  }>;
};

/**
 * OCR PDF po logických dávkach. Každá dávka obsahuje najviac 12 strán a čaká
 * na dokončenie pred spracovaním ďalšej, takže nepreťaží prehliadač ani worker.
 */
export async function extractPdfViaPageOcr(
  file: File,
  consentVersion: string,
  extractFn: (
    payloads: Array<{
      fileName: string;
      fileBase64: string;
      consentVersion: string;
    }>,
  ) => Promise<PdfExtractionResponse>,
): Promise<{
  fileName: string;
  success: boolean;
  text: string;
  usedOcr: boolean;
  error?: string;
}> {
  try {
    const pages = await prepareScannedPdfPages(file);
    const pageTexts: { page: number; text: string }[] = [];
    const pageErrors: string[] = [];

    for (let offset = 0; offset < pages.length; offset += PDF_PAGES_PER_CHUNK) {
      const chunk = pages.slice(offset, offset + PDF_PAGES_PER_CHUNK);
      const res = await extractFn(
        chunk.map((page) => ({
          fileName: page.fileName,
          fileBase64: page.fileBase64,
          consentVersion,
        })),
      );
      for (const page of chunk) {
        const row = res.results?.find(
          (result) => result.fileName === page.fileName,
        );
        if (row?.success && row.text?.trim()) {
          pageTexts.push({ page: page.page, text: row.text });
        } else {
          pageErrors.push(
            `strana ${page.page}: ${row?.error || "OCR zlyhalo"}`,
          );
        }
      }
    }

    const text = joinOcrPageTexts(pageTexts);
    if (text.trim().length < 30) {
      return {
        fileName: file.name,
        success: false,
        text: "",
        usedOcr: true,
        error:
          pageErrors[0] ||
          "OCR po stránkach nevrátilo použiteľný text. Skontrolujte MISTRAL_API_KEY alebo nahrajte stránky ako JPG.",
      };
    }
    return {
      fileName: file.name,
      success: true,
      text,
      usedOcr: true,
      ...(pageErrors.length
        ? { error: `Čiastočné OCR: ${pageErrors.join("; ")}` }
        : {}),
    };
  } catch (err) {
    return {
      fileName: file.name,
      success: false,
      text: "",
      usedOcr: true,
      error: err instanceof Error ? err.message : "Stránkový OCR zlyhal.",
    };
  }
}

/** Text / malý binárny súbor → payload; veľké PDF sa nerieši tu. */
export async function fileToDirectPayload(file: File): Promise<UploadPayload> {
  const lower = file.name.toLowerCase();
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".json")
  ) {
    return { fileName: file.name, textContent: await file.text() };
  }
  return toUploadPayload(file);
}
