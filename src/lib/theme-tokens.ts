/**
 * Jediný zdroj pravdy pre svetlú tému „Pure Light Liquid Glass“.
 *
 * Tokeny sú CSS premenné v namespace `--forenx-*`. Z nich sa odvodzujú
 * sklenené povrchy (pozadie, hrany, odlesk, tieň, focus ring) aj sémantické
 * premenné shadcn komponentov, takže zmena jedného tokenu prekreslí celú
 * aplikáciu vrátane otvoreného modálu.
 */

export const THEME_STORAGE_KEY = "forenx:theme-tokens";
export const THEME_SCHEMA_VERSION = 1;

export type TokenKind = "color" | "opacity" | "length" | "percent";

export type TokenSpec = {
  /** Názov CSS premennej bez prefixu `--forenx-`. */
  key: string;
  label: string;
  group: string;
  kind: TokenKind;
  /** Rozsah pre číselné tokeny (opacity/length/percent). */
  min?: number;
  max?: number;
  step?: number;
  /** Jednotka pre length/percent. */
  unit?: string;
};

export const TOKEN_SPECS: TokenSpec[] = [
  // Povrchy
  {
    key: "color-background",
    label: "Hlavné pozadie",
    group: "Povrchy",
    kind: "color",
  },
  {
    key: "color-background-secondary",
    label: "Sekundárne pozadie",
    group: "Povrchy",
    kind: "color",
  },
  {
    key: "color-panel",
    label: "Panely a karty",
    group: "Povrchy",
    kind: "color",
  },
  {
    key: "color-sidebar",
    label: "Bočné menu",
    group: "Povrchy",
    kind: "color",
  },
  {
    key: "color-modal",
    label: "Modálne okná",
    group: "Povrchy",
    kind: "color",
  },
  {
    key: "color-input",
    label: "Vstupné polia",
    group: "Povrchy",
    kind: "color",
  },
  {
    key: "color-glass-fallback",
    label: "Sklo bez rozostrenia",
    group: "Povrchy",
    kind: "color",
  },

  // Text a akcie
  {
    key: "color-text-primary",
    label: "Primárny text",
    group: "Text a akcie",
    kind: "color",
  },
  {
    key: "color-text-secondary",
    label: "Sekundárny text",
    group: "Text a akcie",
    kind: "color",
  },
  {
    key: "color-accent",
    label: "Akcent / hlavné tlačidlo",
    group: "Text a akcie",
    kind: "color",
  },
  {
    key: "color-text-button",
    label: "Text hlavného tlačidla",
    group: "Text a akcie",
    kind: "color",
  },
  {
    key: "color-button-secondary",
    label: "Sekundárne tlačidlo",
    group: "Text a akcie",
    kind: "color",
  },
  {
    key: "color-text-button-secondary",
    label: "Text sekundárneho tlačidla",
    group: "Text a akcie",
    kind: "color",
  },

  // Hrany, tiene, stavy
  {
    key: "color-border",
    label: "Okraje",
    group: "Hrany a stavy",
    kind: "color",
  },
  {
    key: "color-highlight",
    label: "Svetelná hrana",
    group: "Hrany a stavy",
    kind: "color",
  },
  { key: "color-shadow", label: "Tieň", group: "Hrany a stavy", kind: "color" },
  { key: "color-focus", label: "Focus", group: "Hrany a stavy", kind: "color" },
  {
    key: "color-success",
    label: "Úspech",
    group: "Hrany a stavy",
    kind: "color",
  },
  {
    key: "color-warning",
    label: "Upozornenie",
    group: "Hrany a stavy",
    kind: "color",
  },
  {
    key: "color-danger",
    label: "Chyba",
    group: "Hrany a stavy",
    kind: "color",
  },
  {
    key: "color-info",
    label: "Informácia",
    group: "Hrany a stavy",
    kind: "color",
  },

  // Materiál skla
  {
    key: "glass-opacity",
    label: "Priehľadnosť kariet",
    group: "Materiál",
    kind: "opacity",
    min: 0.3,
    max: 1,
    step: 0.01,
  },
  {
    key: "sidebar-opacity",
    label: "Priehľadnosť menu",
    group: "Materiál",
    kind: "opacity",
    min: 0.3,
    max: 1,
    step: 0.01,
  },
  {
    key: "modal-opacity",
    label: "Priehľadnosť modálu",
    group: "Materiál",
    kind: "opacity",
    min: 0.4,
    max: 1,
    step: 0.01,
  },
  {
    key: "input-opacity",
    label: "Priehľadnosť polí",
    group: "Materiál",
    kind: "opacity",
    min: 0.4,
    max: 1,
    step: 0.01,
  },
  {
    key: "border-opacity",
    label: "Sila okrajov",
    group: "Materiál",
    kind: "opacity",
    min: 0.1,
    max: 1,
    step: 0.01,
  },
  {
    key: "glass-blur",
    label: "Rozostrenie skla",
    group: "Materiál",
    kind: "length",
    min: 0,
    max: 48,
    step: 1,
    unit: "px",
  },
  {
    key: "glass-saturation",
    label: "Sýtosť skla",
    group: "Materiál",
    kind: "percent",
    min: 100,
    max: 200,
    step: 1,
    unit: "%",
  },
  {
    key: "glass-radius",
    label: "Zaoblenie kariet",
    group: "Materiál",
    kind: "length",
    min: 0,
    max: 40,
    step: 1,
    unit: "px",
  },
  {
    key: "control-radius",
    label: "Zaoblenie ovládačov",
    group: "Materiál",
    kind: "length",
    min: 0,
    max: 28,
    step: 1,
    unit: "px",
  },
];

export const TOKEN_KEYS = TOKEN_SPECS.map((spec) => spec.key);

const SPEC_BY_KEY = new Map(TOKEN_SPECS.map((spec) => [spec.key, spec]));

export type ThemeTokens = Record<string, string>;

/** Predvolená téma: WHITE / FROSTED GREY. */
export const DEFAULT_THEME: ThemeTokens = {
  "color-background": "#ffffff",
  "color-background-secondary": "#f5f5f7",
  "color-panel": "#f3f3f5",
  "color-sidebar": "#ededf0",
  "color-modal": "#fafafc",
  "color-input": "#ffffff",
  "color-glass-fallback": "#f1f1f4",

  "color-text-primary": "#1d1d1f",
  "color-text-secondary": "#62646b",
  "color-accent": "#303238",
  "color-text-button": "#ffffff",
  "color-button-secondary": "#e9e9ed",
  "color-text-button-secondary": "#303238",

  "color-border": "#d6d7dc",
  "color-highlight": "#ffffff",
  "color-shadow": "#20232c",
  "color-focus": "#245caa",
  "color-success": "#187044",
  "color-warning": "#8a5700",
  "color-danger": "#b42335",
  "color-info": "#245caa",

  "glass-opacity": "0.72",
  "sidebar-opacity": "0.82",
  "modal-opacity": "0.9",
  "input-opacity": "0.88",
  "border-opacity": "0.66",
  "glass-blur": "24px",
  "glass-saturation": "115%",
  "glass-radius": "24px",
  "control-radius": "14px",
};

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!HEX_RE.test(raw)) return null;
  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return raw;
}

function parseNumeric(spec: TokenSpec, value: string): string | null {
  const unit = spec.unit ?? "";
  const raw = value.trim();
  if (unit && !raw.endsWith(unit)) return null;
  const numeric = Number.parseFloat(unit ? raw.slice(0, -unit.length) : raw);
  if (!Number.isFinite(numeric)) return null;
  const min = spec.min ?? 0;
  const max = spec.max ?? 1;
  if (numeric < min || numeric > max) return null;
  return `${numeric}${unit}`;
}

/** Overí jednu hodnotu tokenu; vráti normalizovaný zápis alebo null. */
export function validateToken(key: string, value: unknown): string | null {
  const spec = SPEC_BY_KEY.get(key);
  if (!spec) return null;
  if (typeof value !== "string") return null;
  if (value.length > 32) return null;
  // Import nesmie prepašovať CSS ani HTML.
  if (/[;{}<>()"'\\]|url|expression|@import/i.test(value)) return null;
  if (spec.kind === "color") return normalizeHex(value);
  return parseNumeric(spec, value);
}

export type ThemeValidationResult = {
  tokens: ThemeTokens;
  rejected: string[];
};

/** Prijme len povolené kľúče a platné hodnoty, zvyšok doplní z predvolenej témy. */
export function sanitizeTokens(input: unknown): ThemeValidationResult {
  const rejected: string[] = [];
  const tokens: ThemeTokens = { ...DEFAULT_THEME };
  if (!input || typeof input !== "object") {
    return { tokens, rejected: ["payload"] };
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const valid = validateToken(key, value);
    if (valid === null) {
      rejected.push(key);
      continue;
    }
    tokens[key] = valid;
  }
  return { tokens, rejected };
}

export type ThemeFile = {
  version: number;
  name: string;
  tokens: ThemeTokens;
};

export function exportTheme(
  tokens: ThemeTokens,
  name = "ForenX téma",
): ThemeFile {
  return { version: THEME_SCHEMA_VERSION, name, tokens: { ...tokens } };
}

export type ImportResult =
  | { ok: true; tokens: ThemeTokens; rejected: string[] }
  | { ok: false; error: string };

export function importTheme(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Súbor nie je platný JSON." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Súbor neobsahuje objekt s témou." };
  }
  const file = parsed as Partial<ThemeFile>;
  if (file.version !== THEME_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Nepodporovaná verzia témy (očakáva sa ${THEME_SCHEMA_VERSION}).`,
    };
  }
  const { tokens, rejected } = sanitizeTokens(file.tokens);
  if (rejected.includes("payload")) {
    return { ok: false, error: "Chýba zoznam tokenov." };
  }
  return { ok: true, tokens, rejected };
}

/* ------------------------------------------------------------------ */
/* Kontrast                                                            */
/* ------------------------------------------------------------------ */

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex) ?? "#000000";
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Zmieša priesvitný povrch s podkladom — kontrast sa počíta voči výsledku. */
export function blendOver(
  foreground: string,
  background: string,
  alpha: number,
): string {
  const [fr, fg, fb] = hexToRgb(foreground);
  const [br, bg, bb] = hexToRgb(background);
  const a = Math.max(0, Math.min(1, alpha));
  return rgbToHex(
    fr * a + br * (1 - a),
    fg * a + bg * (1 - a),
    fb * a + bb * (1 - a),
  );
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

export type ContrastIssue = {
  label: string;
  ratio: number;
  /** Navrhovaná oprava — čitateľný text na danom povrchu. */
  suggestion: string;
  tokenKey: string;
};

const MIN_CONTRAST = 4.5;

/** Vyhodnotí kontrast voči skutočnému (zmiešanému) povrchu, nie voči priesvitnej farbe. */
export function auditContrast(tokens: ThemeTokens): ContrastIssue[] {
  const background = tokens["color-background"] ?? "#ffffff";
  const panel = blendOver(
    tokens["color-panel"] ?? "#f3f3f5",
    background,
    Number.parseFloat(tokens["glass-opacity"] ?? "0.72"),
  );
  const modal = blendOver(
    tokens["color-modal"] ?? "#fafafc",
    background,
    Number.parseFloat(tokens["modal-opacity"] ?? "0.9"),
  );
  const input = blendOver(
    tokens["color-input"] ?? "#ffffff",
    panel,
    Number.parseFloat(tokens["input-opacity"] ?? "0.88"),
  );

  const checks: Array<{
    label: string;
    fg: string;
    bg: string;
    tokenKey: string;
  }> = [
    {
      label: "Primárny text na karte",
      fg: tokens["color-text-primary"] ?? "",
      bg: panel,
      tokenKey: "color-text-primary",
    },
    {
      label: "Sekundárny text na karte",
      fg: tokens["color-text-secondary"] ?? "",
      bg: panel,
      tokenKey: "color-text-secondary",
    },
    {
      label: "Primárny text na pozadí",
      fg: tokens["color-text-primary"] ?? "",
      bg: background,
      tokenKey: "color-text-primary",
    },
    {
      label: "Text v modáli",
      fg: tokens["color-text-primary"] ?? "",
      bg: modal,
      tokenKey: "color-text-primary",
    },
    {
      label: "Text vo vstupnom poli",
      fg: tokens["color-text-primary"] ?? "",
      bg: input,
      tokenKey: "color-text-primary",
    },
    {
      label: "Text hlavného tlačidla",
      fg: tokens["color-text-button"] ?? "",
      bg: tokens["color-accent"] ?? "",
      tokenKey: "color-text-button",
    },
    {
      label: "Text sekundárneho tlačidla",
      fg: tokens["color-text-button-secondary"] ?? "",
      bg: blendOver(tokens["color-button-secondary"] ?? "#e9e9ed", panel, 1),
      tokenKey: "color-text-button-secondary",
    },
  ];

  const issues: ContrastIssue[] = [];
  for (const check of checks) {
    if (!check.fg || !check.bg) continue;
    const ratio = contrastRatio(check.fg, check.bg);
    if (ratio >= MIN_CONTRAST) continue;
    issues.push({
      label: check.label,
      ratio: Math.round(ratio * 100) / 100,
      suggestion: relativeLuminance(check.bg) > 0.4 ? "#1d1d1f" : "#ffffff",
      tokenKey: check.tokenKey,
    });
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Aplikácia a perzistencia                                            */
/* ------------------------------------------------------------------ */

export function applyTokens(tokens: ThemeTokens, target?: HTMLElement): void {
  const root =
    target ??
    (typeof document === "undefined" ? null : document.documentElement);
  if (!root) return;
  for (const key of TOKEN_KEYS) {
    const value = tokens[key];
    if (value) root.style.setProperty(`--forenx-${key}`, value);
  }
}

export function clearTokens(target?: HTMLElement): void {
  const root =
    target ??
    (typeof document === "undefined" ? null : document.documentElement);
  if (!root) return;
  for (const key of TOKEN_KEYS) root.style.removeProperty(`--forenx-${key}`);
}

/** Bezpečné načítanie: poškodený záznam sa zahodí a použije sa predvolená téma. */
export function loadStoredTheme(): ThemeTokens {
  if (typeof window === "undefined") return { ...DEFAULT_THEME };
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME };
    const result = importTheme(raw);
    if (!result.ok) {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
      return { ...DEFAULT_THEME };
    }
    return result.tokens;
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function saveTheme(tokens: ThemeTokens): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify(exportTheme(tokens)),
    );
  } catch {
    /* plné úložisko nesmie zhodiť rozhranie */
  }
}

export function isDefaultTheme(tokens: ThemeTokens): boolean {
  return TOKEN_KEYS.every((key) => tokens[key] === DEFAULT_THEME[key]);
}

/* ------------------------------------------------------------------ */
/* HSV pomôcky pre plynulý picker                                      */
/* ------------------------------------------------------------------ */

export type Hsv = { h: number; s: number; v: number };

export function hexToHsv(hex: string): Hsv {
  const [r255, g255, b255] = hexToRgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgbToHex((rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255);
}
