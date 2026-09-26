/**
 * Príprava avatara: validácia formátov, HEIC prevod, orez + export WebP/JPEG.
 */

import { convertHeic, isHeicFile } from "@/lib/upload-prep";
import type { Area } from "react-easy-crop";

/** Max. veľkosť vstupu pred orezom. */
export const AVATAR_MAX_INPUT_BYTES = 8 * 1024 * 1024;
/** Výstupná hrana (1:1). */
export const AVATAR_OUTPUT_EDGE = 512;
const WEBP_QUALITY = 0.88;
const JPEG_QUALITY = 0.9;

const EXT_OK = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
const MIME_OK = /^image\/(jpeg|pjpeg|png|webp|gif|heic|heif)(-sequence)?$/i;

/** accept atribút pre <input type="file"> — JPEG, PNG, WebP, GIF, HEIC/HEIF. */
export const AVATAR_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";

export function isAllowedAvatarFile(file: {
  name: string;
  type?: string;
}): boolean {
  const type = (file.type ?? "").trim();
  if (type && MIME_OK.test(type)) return true;
  return EXT_OK.test(file.name);
}

export function validateAvatarFile(file: File): string | null {
  if (!isAllowedAvatarFile(file)) {
    return "Povolené formáty: JPEG, PNG, WebP, GIF a HEIC/HEIF.";
  }
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    return `Fotka je príliš veľká (max. ${(AVATAR_MAX_INPUT_BYTES / (1024 * 1024)).toFixed(0)} MB).`;
  }
  return null;
}

/** Načíta súbor do object URL (po prípadnom HEIC→JPEG). */
export async function loadAvatarImageSrc(file: File): Promise<string> {
  const err = validateAvatarFile(file);
  if (err) throw new Error(err);
  const prepared = isHeicFile(file) ? await convertHeic(file) : file;
  if (isHeicFile(prepared)) {
    throw new Error("HEIC sa nepodarilo previesť. Skúste JPEG alebo PNG.");
  }
  return URL.createObjectURL(prepared);
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("Obrázok sa nepodarilo načítať.")),
    );
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

/**
 * Oreže podľa pixelArea z react-easy-crop a exportuje WebP (fallback JPEG).
 */
export async function cropAvatarToBlob(
  imageSrc: string,
  pixelCrop: Area,
  edge = AVATAR_OUTPUT_EDGE,
): Promise<{
  blob: Blob;
  mime: "image/webp" | "image/jpeg";
  ext: "webp" | "jpg";
}> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nie je dostupný.");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    edge,
    edge,
  );

  const webp = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  if (webp && webp.size > 0) {
    return { blob: webp, mime: "image/webp", ext: "webp" };
  }
  const jpeg = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  if (!jpeg) throw new Error("Export fotky zlyhal.");
  return { blob: jpeg, mime: "image/jpeg", ext: "jpg" };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

/** Data URL pre lokálny profil (localStorage). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Čítanie fotky zlyhalo."));
    };
    reader.onerror = () => reject(new Error("Čítanie fotky zlyhalo."));
    reader.readAsDataURL(blob);
  });
}

export const AVATAR_STORAGE_BUCKET = "avatars";

export function avatarStoragePath(userId: string, ext: "webp" | "jpg"): string {
  return `${userId}/avatar.${ext}`;
}
