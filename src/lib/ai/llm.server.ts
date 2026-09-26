/** Serverová AI vrstva: všetky požiadavky smerujú výhradne na Mistral API. */
import {
  callMistral,
  callMistralOcr,
  mistralConfigured,
  mistralModel,
  timeoutForPurpose,
  type MistralMessage,
  type MistralPurpose,
  type MistralResult,
} from "./mistral.server";

export type LlmProvider = "mistral";
export type LlmResult = MistralResult & { provider?: LlmProvider };

export function llmConfigured(purpose: MistralPurpose = "chat"): boolean {
  return mistralConfigured(purpose);
}
export function activeProvider(
  purpose: MistralPurpose = "chat",
): LlmProvider | null {
  return mistralConfigured(purpose) ? "mistral" : null;
}
export function preferredLlmModel(): string {
  return mistralModel();
}
export function providerDisplayName(_provider: LlmProvider): string {
  return "Mistral";
}
export async function callLlm(options: {
  messages: MistralMessage[];
  maxTokens?: number;
  purpose?: MistralPurpose;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<LlmResult> {
  const purpose = options.purpose ?? "chat";
  const result = await callMistral({
    ...options,
    purpose,
    timeoutMs: options.timeoutMs ?? timeoutForPurpose(purpose),
  });
  return { ...result, provider: "mistral" };
}

/** OCR fallback po extrakcii textovej vrstvy používa výhradne Mistral OCR. */
export async function extractWithOcrFallback(
  fileBuffer: Buffer,
  fileName: string,
): Promise<string> {
  if (!mistralConfigured("analysis")) {
    throw new Error(
      "OCR nie je nakonfigurované (chýba MISTRAL_API_KEY alebo MISTRAL_API_KEY_ANALYSIS).",
    );
  }
  return callMistralOcr(fileBuffer, fileName);
}
