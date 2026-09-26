/**
 * Serverový klient pre Mistral API (POST https://api.mistral.ai/v1/chat/completions).
 * Kľúč `MISTRAL_API_KEY` je serverové tajomstvo — nikdy sa nedostane do klientského balíka.
 * Model sa nastavuje serverovou premennou `MISTRAL_MODEL`.
 */

export const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
export const DEFAULT_MODEL = "mistral-large-latest";
/** Bežný chat a krátke kontroly. */
export const REQUEST_TIMEOUT_MS = 35_000;
/**
 * Hĺbková analýza spisu (autopilot, OCR, dlhé dokumenty). Model pri 50 000+
 * znakoch a štruktúrovanom JSON výstupe bežne potrebuje 45–90 sekúnd.
 */
export const ANALYSIS_TIMEOUT_MS = 300_000;

export function timeoutForPurpose(purpose: "chat" | "analysis"): number {
  return purpose === "analysis" ? ANALYSIS_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
}

export type MistralMessage = { role: "system" | "user"; content: string };

export type MistralResult =
  | {
      status: "ok";
      content: string;
      usage: { prompt: number | null; completion: number | null };
      model: string;
    }
  | {
      status: "not_configured" | "timeout" | "rate_limited" | "failed";
      message: string;
      retryAfterSeconds?: number;
    };

export function mistralModel(): string {
  return process.env["MISTRAL_MODEL"] || DEFAULT_MODEL;
}

/**
 * Účel volania určuje, ktorý kľúč sa použije:
 * - "chat" → MISTRAL_API_KEY_CHAT (asistent, kontroly, zhrnutia)
 * - "analysis" → MISTRAL_API_KEY_ANALYSIS (čítanie a analýza dokumentov, OCR, autopilot)
 * Kľúče sa nemiešajú; staršie MISTRAL_API_KEY slúži len ako záloha.
 */
export type MistralPurpose = "chat" | "analysis";

export function mistralApiKey(
  purpose: MistralPurpose = "chat",
): string | undefined {
  const dedicated =
    purpose === "analysis"
      ? process.env["MISTRAL_API_KEY_ANALYSIS"]
      : process.env["MISTRAL_API_KEY_CHAT"];
  return (
    dedicated?.trim() || process.env["MISTRAL_API_KEY"]?.trim() || undefined
  );
}

export function mistralConfigured(purpose: MistralPurpose = "chat"): boolean {
  return Boolean(mistralApiKey(purpose));
}

type CallOptions = {
  messages: MistralMessage[];
  model?: string;
  maxTokens?: number;
  purpose?: MistralPurpose;
  /** Prepíše časový limit odvodený z účelu volania. */
  timeoutMs?: number;
  /** Injektovateľné len v testoch. */
  fetchImpl?: typeof fetch;
};

/**
 * Jedno volanie s časovým limitom. Opakuje sa NAJVIAC raz a len pri jednoznačne
 * prechodnej chybe (429 alebo 503) s rešpektovaním hlavičky Retry-After.
 * Po nejednoznačnom zlyhaní (timeout, prerušené spojenie) sa neopakuje —
 * požiadavka už mohla byť u poskytovateľa spracovaná a účtovaná.
 */
export async function callMistral(
  options: CallOptions,
): Promise<MistralResult> {
  const apiKey = mistralApiKey(options.purpose ?? "chat");
  if (!apiKey) {
    return { status: "not_configured", message: "AI nie je nakonfigurovaná." };
  }
  const model = options.model ?? mistralModel();
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs =
    options.timeoutMs ?? timeoutForPurpose(options.purpose ?? "chat");

  const attempt = async (): Promise<
    | { kind: "ok"; body: unknown }
    | { kind: "retry"; after: number }
    | MistralResult
  > => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const payload = JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: options.maxTokens ?? 900,
      response_format: { type: "json_object" },
      messages: options.messages,
    });
    // Dlhé analysis volania cez VPS worker (proxy_read_timeout 300s), chat ostáva priamy.
    const workerUrl = process.env["FORENX_AI_WORKER_URL"]?.replace(/\/$/, "");
    const workerKey = process.env["FORENX_AI_WORKER_KEY"]?.trim();
    const useWorker =
      (options.purpose ?? "chat") === "analysis" &&
      Boolean(workerUrl && workerKey) &&
      !options.fetchImpl;

    try {
      let response: Response;
      try {
        response = await doFetch(
          useWorker ? `${workerUrl}/v1/mistral/chat` : MISTRAL_ENDPOINT,
          {
            method: "POST",
            headers: useWorker
              ? {
                  "content-type": "application/json",
                  "x-forenx-worker-key": workerKey!,
                  "x-mistral-authorization": `Bearer ${apiKey}`,
                }
              : {
                  "content-type": "application/json",
                  authorization: `Bearer ${apiKey}`,
                },
            body: payload,
            signal: controller.signal,
          },
        );
      } catch (fetchErr) {
        if (
          useWorker &&
          !(fetchErr instanceof Error && fetchErr.name === "AbortError")
        ) {
          console.warn(
            "[Mistral] Worker call failed, falling back to direct endpoint:",
            fetchErr,
          );
          response = await doFetch(MISTRAL_ENDPOINT, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${apiKey}`,
            },
            body: payload,
            signal: controller.signal,
          });
        } else {
          throw fetchErr;
        }
      }

      if (useWorker && (response.status === 502 || response.status === 504)) {
        console.warn(
          `[Mistral] Worker returned ${response.status}, falling back to direct endpoint`,
        );
        response = await doFetch(MISTRAL_ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: payload,
          signal: controller.signal,
        });
      }

      if (response.status === 429 || response.status === 503) {
        const header = response.headers.get("retry-after");
        const after = header ? Number(header) : 2;
        return {
          kind: "retry",
          after: Number.isFinite(after) ? Math.min(after, 10) : 2,
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          status: "failed",
          message: "Mistral odmietol kľúč (neplatný alebo bez oprávnenia).",
        };
      }
      if (response.status === 402) {
        return {
          status: "failed",
          message:
            "Mistral má vyčerpaný kredit — doplňte kredit u poskytovateľa.",
        };
      }
      if (!response.ok) {
        return {
          status: "failed",
          message: `Poskytovateľ vrátil chybu ${response.status}.`,
        };
      }
      return { kind: "ok", body: await response.json() };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          status: "timeout",
          message:
            options.purpose === "analysis"
              ? `Analýza spisu prekročila časový limit (${Math.round(timeoutMs / 1000)} s). Rozdeľte spis na menšie časti a skúste znova.`
              : "Volanie AI prekročilo časový limit.",
        };
      }
      return {
        status: "failed",
        message: "Spojenie s poskytovateľom zlyhalo.",
      };
    } finally {
      clearTimeout(timer);
    }
  };

  // Najviac 3 pokusy a len pri jednoznačne prechodnej chybe (429/503).
  // Čakanie rešpektuje Retry-After, inak exponenciálne 1 s → 2 s.
  let result = await attempt();
  for (let retry = 0; retry < 2; retry++) {
    if (!("kind" in result) || result.kind !== "retry") break;
    const backoff = Math.max(result.after, 2 ** retry);
    await new Promise((r) => setTimeout(r, Math.min(backoff, 8) * 1000));
    const next = await attempt();
    if ("kind" in next && next.kind === "retry" && retry === 1) {
      return {
        status: "rate_limited",
        message: "Poskytovateľ je momentálne vyťažený. Skúste to o chvíľu.",
        retryAfterSeconds: next.after,
      };
    }
    result = next;
  }
  if ("kind" in result && result.kind === "retry") {
    return {
      status: "rate_limited",
      message: "Poskytovateľ je momentálne vyťažený. Skúste to o chvíľu.",
      retryAfterSeconds: result.after,
    };
  }
  if (!("kind" in result)) return result;

  const body = result.body as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    return { status: "failed", message: "Odpoveď AI bola prázdna." };
  }
  return {
    status: "ok",
    content,
    // Chýbajúcu spotrebu neuvádzame ako nulu — ostáva neznáma.
    usage: {
      prompt:
        typeof body.usage?.prompt_tokens === "number"
          ? body.usage.prompt_tokens
          : null,
      completion:
        typeof body.usage?.completion_tokens === "number"
          ? body.usage.completion_tokens
          : null,
    },
    model,
  };
}

/** Safe provider errors: never expose response bodies, credentials or signed URLs. */
export function mistralHttpError(status: number): string {
  if (status === 401 || status === 403)
    return "Mistral odmietol kľúč (neplatný alebo bez oprávnenia).";
  if (status === 402)
    return "Mistral má vyčerpaný kredit — doplňte kredit u poskytovateľa.";
  if (status === 429)
    return "Mistral dosiahol limit požiadaviek. Skúste to o chvíľu.";
  if (status === 503)
    return "Mistral je dočasne nedostupný. Skúste to o chvíľu.";
  return `Mistral vrátil chybu ${status}. Skúste znova.`;
}

async function ocrFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.name === "AbortError"
        ? "Mistral OCR prekročilo časový limit. Skúste menší súbor."
        : "Spojenie s Mistral OCR zlyhalo. Skontrolujte pripojenie a skúste znova.",
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mistral OCR API (POST https://api.mistral.ai/v1/ocr).
 * Slúži ako fallback pre skenované PDF (bez textovej vrstvy) a obrázky listín.
 * 1. Upload dočasného súboru cez /v1/files (purpose: "ocr")
 * 2. Získanie podpísanej URL cez /v1/files/:id/url
 * 3. Spustenie mistral-ocr-latest
 * 4. Asynchrónne zmazanie dočasného súboru
 */
export async function callMistralOcr(
  fileBuffer: Buffer,
  fileName: string,
): Promise<string> {
  const apiKey = mistralApiKey("analysis");
  if (!apiKey) {
    throw new Error(
      "MISTRAL_API_KEY_ANALYSIS nie je nastavený. Pre OCR je potrebný API kľúč.",
    );
  }

  const mimeByExt: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    tif: "image/tiff",
    tiff: "image/tiff",
    bmp: "image/bmp",
  };
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mime = mimeByExt[ext] ?? "application/octet-stream";

  // 1. Upload do /v1/files
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mime });
  formData.append("file", blob, fileName);
  formData.append("purpose", "ocr");

  const uploadRes = await ocrFetch("https://api.mistral.ai/v1/files", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(mistralHttpError(uploadRes.status));
  }

  const uploadData = (await uploadRes.json()) as { id?: string };
  const fileId = uploadData.id;
  if (!fileId) {
    throw new Error("Mistral File Upload nevrátil ID súboru.");
  }

  try {
    // 2. Získaj signed URL
    const signedUrlRes = await ocrFetch(
      `https://api.mistral.ai/v1/files/${fileId}/url`,
      {
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!signedUrlRes.ok) {
      throw new Error(mistralHttpError(signedUrlRes.status));
    }

    const signedUrlData = (await signedUrlRes.json()) as { url: string };
    const documentUrl = signedUrlData.url;

    // 3. Spusť OCR
    const isImage = /\.(png|jpe?g|webp|tiff?|bmp)$/i.test(fileName);
    const docPayload = isImage
      ? { type: "image_url", image_url: documentUrl }
      : { type: "document_url", document_url: documentUrl };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000); // 60s timeout pre OCR

    try {
      const ocrRes = await ocrFetch("https://api.mistral.ai/v1/ocr", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "mistral-ocr-latest",
          document: docPayload,
        }),
        signal: controller.signal,
      });

      if (!ocrRes.ok) {
        throw new Error(mistralHttpError(ocrRes.status));
      }

      const ocrData = (await ocrRes.json()) as {
        pages?: Array<{ index: number; markdown: string }>;
      };

      const extracted =
        ocrData.pages?.map((p) => p.markdown).join("\n\n") || "";
      if (!extracted.trim()) {
        throw new Error(
          "Mistral OCR nerozpoznalo žiadny text v nahranom dokumente.",
        );
      }
      return extracted;
    } finally {
      clearTimeout(timer);
    }
  } finally {
    // 4. Cleanup: zmaž súbor z Mistral storage na pozadí
    Promise.resolve(
      fetch(`https://api.mistral.ai/v1/files/${fileId}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${apiKey}` },
      }),
    ).catch((err) => {
      console.warn(
        "Nepodarilo sa vymazať dočasný súbor z Mistral storage:",
        err,
      );
    });
  }
}
