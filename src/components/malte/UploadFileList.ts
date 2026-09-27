export type UploadFileStatus = "queued" | "reading" | "done" | "failed";

export type UploadFileItem = {
  name: string;
  status: UploadFileStatus;
  chars?: number | undefined;
  size?: number | undefined;
  pages?: number | undefined;
  usedOcr?: boolean | undefined;
  error?: string | undefined;
  pdfHeaderOk?: boolean | undefined;
};

export function statusLabel(status: UploadFileStatus): string {
  if (status === "queued") return "čaká";
  if (status === "reading") return "beží";
  if (status === "done") return "hotovo";
  return "chyba";
}

