export type Base64Request = { id: number; buffer: ArrayBuffer };
export type Base64Response =
  | { id: number; kind: "ok"; base64: string }
  | { id: number; kind: "error"; message: string };

const CHUNK = 8192;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

