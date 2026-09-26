import { z } from "zod";
import {
  ForensicCaseUnifiedSchema,
  type ForensicCaseUnified,
} from "@/types/forensic-case";

const EventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    stage: z.number().int().min(0).max(4),
    fileName: z.string().optional(),
  }),
  z.object({
    type: z.literal("result"),
    unifiedCase: ForensicCaseUnifiedSchema,
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export async function readCaseIngestStream(
  stream: ReadableStream<Uint8Array>,
  onProgress: (stage: number, fileName?: string) => void,
): Promise<ForensicCaseUnified> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let result: ForensicCaseUnified | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = EventSchema.parse(JSON.parse(line));
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "progress") onProgress(event.stage, event.fileName);
    if (event.type === "result") result = event.unifiedCase;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      if (pending.length > 5_000_000)
        throw new Error("Výsledok importu presiahol bezpečný limit.");
      let newline;
      while ((newline = pending.indexOf("\n")) >= 0) {
        consume(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
      }
      if (done) break;
    }
    consume(pending);
    if (!result)
      throw new Error(
        "Import sa prerušil pred dokončením. Dáta neboli nahradené.",
      );
    return result;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
