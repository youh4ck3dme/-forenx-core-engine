/**
 * Príprava nahraných spisov pred odoslaním na server:
 * strop veľkosti, zmenšenie fotiek a prevod na Base64 mimo hlavného vlákna.
 */

import type { Base64Request, Base64Response } from "@/workers/base64.worker";

/** Maximálna veľkosť jedného nahraného dôkazného súboru. */
export const MAX_FILE_SIZE = 150 * 1024 * 1024;
/** Maximálna veľkosť celej dávky vybratej v jednom kroku. */
export const MAX_BATCH_SIZE = 300 * 1024 * 1024;
/** Spätná kompatibilita pre existujúce importy. */
export const MAX_UPLOAD_BYTES = MAX_FILE_SIZE;
/** Hranica, nad ktorou sa PDF transparentne spracuje po stránkach. */
export const PDF_AUTO_CHUNK_PAGE_THRESHOLD = 15;
/** Počet strán v jednej OCR dávke. */
export const PDF_PAGES_PER_CHUNK = 12;
/**
 * Jedna stránka OCR ostáva malá aj pri veľkých PDF, aby sa dávky spracovávali
 * spoľahlivo a sekvenčne. Celý PDF súbor sa cez tento limit neodmieta.
 */
export const SAFE_SERVER_FN_BYTES = Math.floor(2.8 * 1024 * 1024);
/** Dlhšia strana fotky po zmenšení. */
export const MAX_IMAGE_EDGE = 2000;
/** Max stránok pri client-side OCR rastení PDF (desktop). */
export const DESKTOP_OCR_PAGE_LIMIT = 30;
const JPEG_QUALITY = 0.82;
const TEXT_EXT = /\.(txt|md|csv|json|html)$/;
const IMAGE_TYPE = /^image\/(jpeg|png|webp)$/;
const HEIC_EXT = /\.(heic|heif)$/i;
const HEIC_TYPE = /^image\/(heic|heif)(-sequence)?$/i;

/** Zoznam prípon a typov pre výber súborov (vrátane fotiek z iPhonu). */
export const UPLOAD_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.json,.md,.html,.rtf,.png,.jpg,.jpeg,.webp,.tiff,.heic,.heif,image/*,application/pdf";

/** Fotka z iPhonu (HEIC/HEIF) — prehliadače ju väčšinou nevedia dekódovať. */
export function isHeicFile(file: { name: string; type?: string }): boolean {
  return HEIC_TYPE.test(file.type ?? "") || HEIC_EXT.test(file.name);
}

/**
 * Prevedie HEIC/HEIF na JPEG, aby ho vedela prečítať AI aj prehliadač.
 * Pri zlyhaní vráti originál — server sa ho ešte môže pokúsiť spracovať.
 */
export async function convertHeic(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;
  try {
    const { heicTo } = await import("heic-to");
    const blob = await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: JPEG_QUALITY,
    });
    const name = file.name.replace(HEIC_EXT, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export type UploadPayload =
  | { fileName: string; textContent: string }
  | { fileName: string; fileBase64: string };

export function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function tooLargeMessage(
  file: { name: string; size: number },
  limit = MAX_UPLOAD_BYTES,
): string {
  return `Súbor „${file.name}" má ${formatMb(file.size)} — maximum je ${formatMb(
    limit,
  )}.`;
}

/** Hláška pre limit serverovej funkcie (Vercel body), nie absolútny 8 MB. */
export function tooLargeForServerFnMessage(file: {
  name: string;
  size: number;
}): string {
  const isPdf = file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    return `Súbor „${file.name}" má ${formatMb(file.size)} — na jeden upload je maximum ${formatMb(
      MAX_FILE_SIZE,
    )}. Veľké PDF sa automaticky spracuje po stránkach (OCR).`;
  }
  return `Súbor „${file.name}" má ${formatMb(file.size)} — na jeden upload je maximum ${formatMb(
    MAX_FILE_SIZE,
  )}.`;
}

export function isOverServerFnBudget(file: { size: number }): boolean {
  return file.size > SAFE_SERVER_FN_BYTES;
}

/** Mapuje sieťovú 413 / body-too-large na SK správu. */
export function mapUploadNetworkError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const lower = raw.toLowerCase();
  if (
    lower.includes("413") ||
    lower.includes("payload too large") ||
    lower.includes("request entity too large") ||
    (lower.includes("body") && lower.includes("limit"))
  ) {
    return "Súbor je príliš veľký na jeden prenos. Skúsim automatické spracovanie PDF po stránkach.";
  }
  return raw || "Nahrávanie súboru zlyhalo.";
}

/** Zachované iba pre spätnú kompatibilitu staršieho OCR modulu. */
export const MOBILE_PAGE_LIMIT = 5;

/** iPhone/iPad Safari (aj iPadOS v desktop režime) má najprísnejší limit pamäte karty. */
export function isMemoryConstrainedBrowser(
  ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent,
  maxTouchPoints: number = typeof navigator === "undefined"
    ? 0
    : (navigator.maxTouchPoints ?? 0),
): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS sa hlási ako Macintosh, ale má dotykovú obrazovku.
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}

const PDF_CHUNK = 512 * 1024;

/**
 * Spočíta strany PDF z metadát po blokoch — dokument sa nikdy nedekóduje celý
 * do pamäte. Pri neznámom formáte vráti undefined.
 */
export async function countPdfPages(file: File): Promise<number | undefined> {
  if (!file.name.toLowerCase().endsWith(".pdf")) return undefined;
  try {
    const decoder = new TextDecoder("latin1");
    let carry = "";
    let pages = 0;
    for (let offset = 0; offset < file.size; offset += PDF_CHUNK) {
      const slice = file.slice(offset, Math.min(offset + PDF_CHUNK, file.size));
      const text =
        carry + decoder.decode(new Uint8Array(await slice.arrayBuffer()));
      pages += (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      // Prekryv pre značku rozdelenú medzi blokmi.
      carry = text.slice(-32);
    }
    return pages > 0 ? pages : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Zistí počet strán bez nútenia používateľa deliť dokument. Veľké PDF sa
 * spracuje po dávkach, aj na zariadeniach s obmedzenou pamäťou.
 */
export async function assessPdfMemory(
  file: File,
  _constrained: boolean = isMemoryConstrainedBrowser(),
): Promise<{ pages?: number | undefined; blockedReason?: string | undefined }> {
  const pages = await countPdfPages(file);
  return { pages };
}

/** Rozdelí výber na spracovateľné súbory a odmietnuté (príliš veľké). */
export function partitionBySize<T extends { name: string; size: number }>(
  files: T[],
  limit = MAX_FILE_SIZE,
): { accepted: T[]; rejected: { file: T; reason: string }[] } {
  const accepted: T[] = [];
  const rejected: { file: T; reason: string }[] = [];
  for (const file of files) {
    if (file.size > limit) {
      rejected.push({
        file,
        reason: tooLargeMessage(file, limit),
      });
    } else accepted.push(file);
  }

  return { accepted, rejected };
}

export function exceedsBatchSize(files: { size: number }[]): boolean {
  return files.reduce((total, file) => total + file.size, 0) > MAX_BATCH_SIZE;
}

/** Zmenší fotku na dlhšiu stranu `maxEdge`. Pri akomkoľvek probléme vráti originál. */
export async function downscaleImage(
  file: File,
  maxEdge = MAX_IMAGE_EDGE,
): Promise<Blob> {
  if (!IMAGE_TYPE.test(file.type)) return file;
  if (
    typeof createImageBitmap !== "function" ||
    typeof OffscreenCanvas === "undefined"
  ) {
    return file;
  }
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return file;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: JPEG_QUALITY,
    });
    return blob.size > 0 && blob.size < file.size ? blob : file;
  } catch {
    return file;
  } finally {
    // Uvoľní pamäť hneď, nečaká sa na zberač odpadkov.
    bitmap?.close();
  }
}

const CHUNK = 8192;

/** Synchrónna záloha, keď prehliadač nepodporuje Web Workery. */
export function bytesToBase64Sync(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

let worker: Worker | undefined;
let nextId = 1;

function getWorker(): Worker | undefined {
  if (worker) return worker;
  if (typeof Worker === "undefined") return undefined;
  try {
    worker = new Worker(
      new URL("../workers/base64.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    return worker;
  } catch {
    return undefined;
  }
}

/** Prevod na Base64 vo workeri; pri chybe alebo bez podpory sa použije hlavné vlákno. */
export async function encodeBase64(buffer: ArrayBuffer): Promise<string> {
  const w = getWorker();
  if (!w) return bytesToBase64Sync(new Uint8Array(buffer));
  const id = nextId++;
  try {
    return await new Promise<string>((resolve, reject) => {
      const onMessage = (event: MessageEvent<Base64Response>) => {
        if (event.data.id !== id) return;
        w.removeEventListener("message", onMessage);
        w.removeEventListener("error", onError);
        if (event.data.kind === "ok") resolve(event.data.base64);
        else reject(new Error(event.data.message));
      };
      const onError = () => {
        w.removeEventListener("message", onMessage);
        w.removeEventListener("error", onError);
        reject(new Error("Prevod súboru vo vlákne zlyhal."));
      };
      w.addEventListener("message", onMessage);
      w.addEventListener("error", onError);
      w.postMessage({ id, buffer } satisfies Base64Request, [buffer]);
    });
  } catch {
    return bytesToBase64Sync(new Uint8Array(buffer));
  }
}

/** Pripraví jeden súbor na odoslanie serverovej funkcii. */
export async function toUploadPayload(file: File): Promise<UploadPayload> {
  if (file.size > SAFE_SERVER_FN_BYTES) {
    throw new Error(tooLargeForServerFnMessage(file));
  }
  if (TEXT_EXT.test(file.name.toLowerCase())) {
    return { fileName: file.name, textContent: await file.text() };
  }
  // Fotky z iPhonu prevedieme na JPEG, až potom zmenšujeme.
  const source = await convertHeic(file);
  const blob = await downscaleImage(source);
  const buffer = await blob.arrayBuffer();
  return { fileName: source.name, fileBase64: await encodeBase64(buffer) };
}
