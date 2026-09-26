import path from "node:path";

const ALLOWED_EXT = new Set([
  ".md",
  ".txt",
  ".csv",
  ".json",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

export function quarantineRoot(cwd = process.cwd()): string {
  return path.resolve(cwd, "quarantine", "repo-root");
}

/** Bezpečná cesta vnútri quarantine/repo-root — žiadny path traversal. */
export function resolveQuarantineFile(
  fileName: string,
  cwd = process.cwd(),
): string {
  const base = quarantineRoot(cwd);
  const trimmed = fileName.trim();
  const safeName = path.basename(trimmed);
  if (!safeName || safeName !== trimmed) {
    throw new Error("Neplatný názov súboru.");
  }
  const ext = path.extname(safeName).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`Nepodporovaný typ súboru: ${ext || "(bez prípony)"}`);
  }
  const full = path.resolve(base, safeName);
  const relative = path.relative(base, full);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative.includes(`..${path.sep}`)
  ) {
    throw new Error("Cesta mimo quarantine.");
  }
  return full;
}

export function mimeForQuarantine(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".json":
      return "application/json";
    case ".csv":
      return "text/csv";
    case ".md":
      return "text/markdown";
    default:
      return "text/plain";
  }
}

export function isAllowedQuarantineExt(fileName: string): boolean {
  return ALLOWED_EXT.has(path.extname(fileName).toLowerCase());
}
