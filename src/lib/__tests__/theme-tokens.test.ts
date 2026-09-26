import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  TOKEN_KEYS,
  auditContrast,
  blendOver,
  contrastRatio,
  exportTheme,
  hexToHsv,
  hsvToHex,
  importTheme,
  isDefaultTheme,
  normalizeHex,
  sanitizeTokens,
  validateToken,
} from "@/lib/theme-tokens";

describe("validácia tokenov témy", () => {
  it("prijme skrátený hex a doplní ho na šesť znakov", () => {
    expect(normalizeHex("#FFF")).toBe("#ffffff");
    expect(validateToken("color-background", "#FfF")).toBe("#ffffff");
  });

  it("odmietne neznámy kľúč aj pokus prepašovať CSS alebo HTML", () => {
    expect(validateToken("color-evil", "#ffffff")).toBeNull();
    expect(
      validateToken("color-background", "red; background: url(x)"),
    ).toBeNull();
    expect(validateToken("color-background", "<script>")).toBeNull();
  });

  it("drží číselné tokeny v povolenom rozsahu aj s jednotkou", () => {
    expect(validateToken("glass-blur", "24px")).toBe("24px");
    expect(validateToken("glass-blur", "240px")).toBeNull();
    expect(validateToken("glass-blur", "24")).toBeNull();
    expect(validateToken("glass-opacity", "0.5")).toBe("0.5");
    expect(validateToken("glass-opacity", "2")).toBeNull();
  });

  it("sanitácia doplní chýbajúce tokeny z predvolenej témy a nahlási zvyšok", () => {
    const { tokens, rejected } = sanitizeTokens({
      "color-accent": "#123456",
      bogus: "#ffffff",
    });
    expect(tokens["color-accent"]).toBe("#123456");
    expect(tokens["color-background"]).toBe(DEFAULT_THEME["color-background"]);
    expect(rejected).toEqual(["bogus"]);
    expect(Object.keys(tokens).sort()).toEqual([...TOKEN_KEYS].sort());
  });
});

describe("import a export témy", () => {
  it("prejde kolo export → import bez straty hodnôt", () => {
    const custom = { ...DEFAULT_THEME, "color-accent": "#0a3d62" };
    const result = importTheme(JSON.stringify(exportTheme(custom)));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokens["color-accent"]).toBe("#0a3d62");
      expect(result.rejected).toEqual([]);
    }
  });

  it("odmietne neplatný JSON a nesprávnu verziu", () => {
    expect(importTheme("{nie json").ok).toBe(false);
    const wrongVersion = importTheme(
      JSON.stringify({ version: 99, tokens: DEFAULT_THEME }),
    );
    expect(wrongVersion.ok).toBe(false);
  });

  it("neprijme ľubovoľný CSS z importu", () => {
    const result = importTheme(
      JSON.stringify({
        version: 1,
        name: "x",
        tokens: { "color-background": "url(javascript:alert(1))" },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokens["color-background"]).toBe(
        DEFAULT_THEME["color-background"],
      );
      expect(result.rejected).toContain("color-background");
    }
  });

  it("predvolenú tému rozpozná ako nezmenenú", () => {
    expect(isDefaultTheme({ ...DEFAULT_THEME })).toBe(true);
    expect(
      isDefaultTheme({ ...DEFAULT_THEME, "color-accent": "#000000" }),
    ).toBe(false);
  });
});

describe("kontrast voči výslednému povrchu", () => {
  it("zmieša priesvitný povrch s podkladom pred výpočtom", () => {
    expect(blendOver("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("predvolená téma nemá žiadny podkontrastný text", () => {
    expect(auditContrast(DEFAULT_THEME)).toEqual([]);
  });

  it("upozorní a navrhne opravu pri nečitateľnej kombinácii", () => {
    const issues = auditContrast({
      ...DEFAULT_THEME,
      "color-text-secondary": "#eeeeee",
    });
    const issue = issues.find((i) => i.tokenKey === "color-text-secondary");
    expect(issue).toBeDefined();
    expect(issue?.ratio).toBeLessThan(4.5);
    expect(issue?.suggestion).toBe("#1d1d1f");
  });
});

describe("prevod farieb pre picker", () => {
  it("hex → hsv → hex je stabilné", () => {
    for (const hex of ["#ffffff", "#000000", "#245caa", "#b42335"]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });
});
