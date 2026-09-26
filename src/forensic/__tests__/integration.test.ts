import { describe, expect, it } from "./harness";
import { analyzeCase } from "../index";
import { EMPTY_CASE } from "../data/empty";
import { parseCompanyRegistryProfile, buildCompanyEntity } from "../ico-atlas";
import { parseDimitriCheckerReport, mergeDimitriFindings } from "../dimitri";
import type { ForensicCase } from "../types";

describe("Integrácia ICO Atlas a Dimitri Checker v projekte Forendo", () => {
  const baseCase: ForensicCase = {
    ...EMPTY_CASE,
    id: "case-integration-1",
    name: "Testovací prípad",
    entities: [
      {
        id: "ent1",
        name: "Alfa s.r.o.",
        kind: "company",
        role: "spoločnosť",
        ico: "51234567",
        country: "SK",
        x: 0,
        y: 0,
      },
    ],
    transactions: [
      {
        id: "tx1",
        date: "2026-09-01",
        amount: 10000,
        currency: "EUR",
        method: "transfer",
        fromId: "ent1",
        toId: "ent1",
        originCountry: "SK",
        destinationCountry: "CZ",
        description: "Bežná úhrada",
      },
    ],
  };

  it("1. existujúci prípad bez nových externých dát funguje 100% bez zmeny", () => {
    const analysis = analyzeCase(baseCase);
    expect(analysis.caseScore).toBeDefined();
    expect(analysis.totals.transactions).toBe(1);
  });

  it("2. import ICO profilu nezmení existujúce transakčné skóre ani objemy", () => {
    const initialAnalysis = analyzeCase(baseCase);
    const initialScore = initialAnalysis.caseScore;
    const initialVolume = initialAnalysis.totals.volume;

    const icoProfile = parseCompanyRegistryProfile({
      ico: "51234567",
      legalName: "Alfa s.r.o.",
      country: "SK",
      source: {
        source: "ico-atlas",
        capturedAt: new Date().toISOString(),
      },
      statutoryPersons: [],
      businessActivities: [],
    });

    const newCompany = buildCompanyEntity(icoProfile, baseCase.id, "ent1");
    const updatedCase: ForensicCase = {
      ...baseCase,
      entities: [newCompany],
    };

    const updatedAnalysis = analyzeCase(updatedCase);
    expect(updatedAnalysis.totals.volume).toBe(initialVolume);
    expect(updatedAnalysis.caseScore).toBe(initialScore);
  });

  it("3. import Dimitri reportu zachová pôvodné alerty a pridá nové cezhraničné alerty", () => {
    const initialAnalysis = analyzeCase(baseCase);
    const initialAlertCount = initialAnalysis.alerts.length;

    const report = parseDimitriCheckerReport({
      reportId: "rep-dim-int-1",
      capturedAt: new Date().toISOString(),
      source: {
        source: "dimitri-checker",
        capturedAt: new Date().toISOString(),
      },
      countries: ["SK", "CZ"],
      routes: [],
      intermediaries: [],
      signals: [
        {
          code: "V4_FLOW_ALERT",
          label: "Indikátor V4 toku",
          detail: "Signál vyžadujúci overenie na hranici SK/CZ",
          severity: "medium",
          confidence: 80,
        },
      ],
    });

    const merged = mergeDimitriFindings(initialAnalysis, report);
    expect(merged.alerts.length).toBe(initialAlertCount + 1);
  });

  it("4. opakovaný import reportu s rovnakým alert ID nevytvára duplicity v CaseAnalysis", () => {
    const initialAnalysis = analyzeCase(baseCase);
    const report = parseDimitriCheckerReport({
      reportId: "rep-dim-int-dup",
      capturedAt: "2026-09-09T10:00:00.000Z",
      source: {
        source: "dimitri-checker",
        capturedAt: "2026-09-09T10:00:00.000Z",
      },
      countries: ["SK"],
      routes: [],
      intermediaries: [],
      signals: [
        {
          code: "STATIC_SIGNAL",
          label: "Statický signál",
          detail: "Indikátor vyžadujúci overenie",
          severity: "low",
          confidence: 50,
        },
      ],
    });

    const mergedFirst = mergeDimitriFindings(initialAnalysis, report);
    const mergedSecond = mergeDimitriFindings(mergedFirst, report);

    expect(mergedSecond.alerts.length).toBe(mergedFirst.alerts.length);
  });
});
