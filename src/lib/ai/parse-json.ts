/**
 * Spoločný parser odpovedí AI kontrol: odstráni Markdown ohrady a okolitý
 * text, nájde koreňový JSON a overí ho Zod schémou. Neunikajú prompt
 * ani tajomstvá — diagnostika je krátka a čitateľná.
 */
import type { z } from "zod";

export type ParseAiJsonOk<T> = { ok: true; data: T };
export type ParseAiJsonErr = {
  ok: false;
  error: string;
  /** Krátka diagnostika pre vývoj / log (bez surového promptu). */
  diagnostics: string;
};
export type ParseAiJsonResult<T> = ParseAiJsonOk<T> | ParseAiJsonErr;

const MAX_DIAG_LEN = 180;

/** Odstráni ```json … ``` ohrady na začiatku/konci. */
export function stripCodeFences(raw: string): string {
  return raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/**
 * Doplní ukončenie useknutého JSON (odpoveď AI orezaná limitom tokenov).
 * Zatvorí otvorený reťazec a všetky otvorené zátvorky, odstráni visiacu čiarku.
 */
export function repairTruncatedJson(input: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastComplete = -1;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length === 0) lastComplete = i;
    }
  }

  if (stack.length === 0) {
    return lastComplete >= 0 ? input.slice(0, lastComplete + 1) : null;
  }

  let out = input;
  if (inString) out += '"';
  out = out.replace(/,\s*$/, "");
  out = out.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
  while (stack.length > 0) out += stack.pop();
  return out;
}

/**
 * Nájde prvý koreňový JSON objekt alebo pole v texte
 * (ignoruje úvodnú/záverečnú prózu).
 */
export function extractRootJsonText(raw: string): string | null {
  const cleaned = stripCodeFences(raw);
  if (!cleaned) return null;

  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  let start = -1;
  if (objStart < 0 && arrStart < 0) return null;
  if (objStart < 0) start = arrStart;
  else if (arrStart < 0) start = objStart;
  else start = Math.min(objStart, arrStart);

  const candidate = cleaned.slice(start);
  const closing = candidate[0] === "[" ? "]" : "}";
  const end = candidate.lastIndexOf(closing);
  if (end >= 0) return candidate.slice(0, end + 1);
  return candidate;
}

function summarizeParseError(err: unknown): string {
  if (!(err instanceof Error)) return "Neplatný JSON.";
  const msg = err.message.replace(/\s+/g, " ").trim();
  // Odstráň prípadné dlhé úryvky vstupu z SyntaxError.
  const short =
    msg.length > MAX_DIAG_LEN ? `${msg.slice(0, MAX_DIAG_LEN)}…` : msg;
  return short;
}

function summarizeZodIssues(
  issues: { path: PropertyKey[]; message: string }[],
): string {
  const parts = issues.slice(0, 4).map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "(koreň)";
    return `${path}: ${issue.message}`;
  });
  const extra = issues.length > 4 ? ` (+${issues.length - 4})` : "";
  const text = parts.join("; ") + extra;
  return text.length > MAX_DIAG_LEN ? `${text.slice(0, MAX_DIAG_LEN)}…` : text;
}

/**
 * Rozparsuje odpoveď modelu na JSON a overí ju schémou.
 * Pri chybe vráti čitateľnú diagnostiku bez úniku promptu/secretov.
 */
export function parseAiJson<T>(
  raw: string,
  schema: z.ZodType<T>,
): ParseAiJsonResult<T> {
  if (typeof raw !== "string" || !raw.trim()) {
    return {
      ok: false,
      error: "Odpoveď AI bola prázdna.",
      diagnostics: "empty_content",
    };
  }

  const extracted = extractRootJsonText(raw);
  if (!extracted) {
    return {
      ok: false,
      error: "Odpoveď AI neobsahovala JSON objekt ani pole.",
      diagnostics: "no_root_json",
    };
  }

  let parsed: unknown;
  const tryParse = (text: string): boolean => {
    try {
      parsed = JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };

  if (!tryParse(extracted)) {
    const repaired = repairTruncatedJson(extracted);
    if (!repaired || !tryParse(repaired)) {
      let diagnostics = "invalid_json";
      try {
        JSON.parse(extracted);
      } catch (err) {
        diagnostics = summarizeParseError(err);
      }
      return {
        ok: false,
        error: "Odpoveď AI nebola platný JSON.",
        diagnostics,
      };
    }
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: "Odpoveď AI nezodpovedala očakávanej štruktúre.",
      diagnostics: summarizeZodIssues(validated.error.issues),
    };
  }

  return { ok: true, data: validated.data };
}
