import { describe, expect, it } from "./harness";
import {
  buildCrossBorderAnalysis,
  buildDimitriAlerts,
  mergeDimitriFindings,
  parseDimitriCheckerReport,
  validateDimitriReferences,
} from "../dimitri";
import { analyzeCase } from "../index";
import { EMPTY_CASE } from "../data/empty";
import type { ForensicCase } from "../types";

describe("Dimitri Checker Adapter", () => {
  const validReportJson = {
    reportId: "rep-2026-001",
    caseReference: "CASE-101",
    capturedAt: "2026-09-09T14:00:00.000Z",
    source: {
      id: "src-dim-1",
      source: "dimitri-checker",
      capturedAt: "2026-09-09T14:00:00.000Z",
      confidence: 90,
    },
    countries: ["SK", "CZ", "HU"],
    routes: [
      {
        fromCountry: "SK",
        toCountry: "CZ",
        amount: 45000,
        currency: "EUR",
        transactionIds: ["tx1"],
      },
    ],
    intermediaries: [
      {
        name: "Trade Corp CZ",
        entityId: "e1",
        country: "CZ",
        role: "sprostredkovateľ",
      },
    ],
    signals: [
      {
        code: "TRANSIT_SURGE",
        label: "Náhly nárast tranzitného objemu",
        detail: "Signál vyžadujúci overenie: Zvýšený tok na trase SK -> CZ.",
        severity: "high",
        confidence: 85,
        transactionIds: ["tx1"],
      },
    ],
    nomineeIndicators: [
      {
        entityId: "e1",
        name: "Jan Svoboda",
        indicators: [
          "Štatutár vo viacerých subjektoch",
          "Absencia zamestnancov",
        ],
        confidence: 75,
      },
    ],
  };

  const sampleCase: ForensicCase = {
    ...EMPTY_CASE,
    id: "case1",
    entities: [
      {
        id: "e1",
        name: "Jan Svoboda",
        kind: "person",
        role: "konateľ",
        country: "CZ",
        x: 0,
        y: 0,
      },
    ],
    transactions: [
      {
        id: "tx1",
        date: "2026-09-01",
        amount: 45000,
        currency: "EUR",
        method: "transfer",
        fromId: "e1",
        toId: "e1",
        originCountry: "SK",
        destinationCountry: "CZ",
        description: "Platba za tovar",
      },
    ],
  };

  it("1. rozparsuje validný JSON report", () => {
    const report = parseDimitriCheckerReport(validReportJson);
    expect(report.reportId).toBe("rep-2026-001");
    expect(report.countries).toEqual(["SK", "CZ", "HU"]);
    expect(report.signals.length).toBe(1);
  });

  it("2. odmietne neplatný kód krajiny", () => {
    expect(() =>
      parseDimitriCheckerReport({
        ...validReportJson,
        countries: ["INVALID_COUNTRY_CODE"],
      }),
    ).toThrow();
  });

  it("3. odmietne confidence mimo rozsah 0-100", () => {
    expect(() =>
      parseDimitriCheckerReport({
        ...validReportJson,
        source: {
          ...validReportJson.source,
          confidence: 150,
        },
      }),
    ).toThrow();
  });

  it("4. eviduje neznámu transakciu bez selhania importu", () => {
    const report = parseDimitriCheckerReport({
      ...validReportJson,
      routes: [
        {
          fromCountry: "SK",
          toCountry: "CZ",
          transactionIds: ["unknown_tx_999"],
        },
      ],
    });
    const { report: validated, warnings } = validateDimitriReferences(
      report,
      sampleCase,
    );
    expect(warnings.length).toBe(1);
    expect(validated.unlinkedReferences?.transactionIds).toContain(
      "unknown_tx_999",
    );
  });

  it("5. eviduje neznámu entitu bez selhania importu", () => {
    const report = parseDimitriCheckerReport({
      ...validReportJson,
      signals: [
        {
          ...validReportJson.signals[0],
          entityIds: ["unknown_entity_888"],
        },
      ],
    });
    const { warnings } = validateDimitriReferences(report, sampleCase);
    expect(warnings.length).toBe(1);
  });

  it("6. vytvorí cezhraničný alert zo signálov reportu", () => {
    const report = parseDimitriCheckerReport(validReportJson);
    const alerts = buildDimitriAlerts(report, sampleCase);
    expect(alerts.length).toBe(2); // 1 signal + 1 nominee indicator alert
    expect(alerts[0]?.source).toBe("cezhraničné");
  });

  it("7. vytvorí nominee indicator alert bez tvrdenia o vine (neutrálny názov)", () => {
    const report = parseDimitriCheckerReport(validReportJson);
    const alerts = buildDimitriAlerts(report, sampleCase);
    const nomineeAlert = alerts.find((a) =>
      a.title.includes("Indikátory možnej nastrčenej osoby"),
    );
    expect(nomineeAlert).toBeDefined();
    expect(nomineeAlert?.detail).toContain("Vyžaduje overenie");
    expect(nomineeAlert?.detail).not.toContain("biely kôň");
  });

  it("8. správne vybuduje objekt cezhraničnej analýzy", () => {
    const report = parseDimitriCheckerReport(validReportJson);
    const cb = buildCrossBorderAnalysis(report, sampleCase);
    expect(cb.reportId).toBe("rep-2026-001");
    expect(cb.routes.length).toBe(1);
  });

  it("9. zlúči zistenia z reportu do existujúcej CaseAnalysis", () => {
    const initialAnalysis = analyzeCase(sampleCase);
    const report = parseDimitriCheckerReport(validReportJson);
    const merged = mergeDimitriFindings(initialAnalysis, report);

    expect(merged.alerts.length).toBeGreaterThan(initialAnalysis.alerts.length);
  });
});
