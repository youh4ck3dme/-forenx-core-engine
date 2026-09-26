import type {
  CaseEntity,
  CaseTimelineEvent,
  CaseTransaction,
  ForensicCaseUnified,
} from "@/types/forensic-case";

export const GOLDEN_DEMO_CASE_ID = "golden-demo-ppz-442-2026";
const DOCUMENT_ID = "golden-demo-zapisnica";
const HASH = "a".repeat(64);

const entityDefinitions = [
  ["a", "Orion Holding, a.s.", "company", "Materská spoločnosť v úpadku"],
  ["b", "Vektor Consulting, s.r.o.", "company", "Účelová schránková firma"],
  ["c", "Danube Trade, s.r.o.", "company", "Medzičlánok toku"],
  ["d", "Marek Kováč", "person", "Konateľ Orion Holding"],
  ["e", "Lucia Nováková", "person", "Konateľka Orion Holding"],
  ["f", "Peter Biely", "person", "Nasadený biely kôň"],
  ["g", "Astra Logistics, s.r.o.", "company", "Dodávateľ"],
  ["h", "Kappa Property, s.r.o.", "company", "Prepojená spoločnosť"],
  ["i", "Moneta Services, s.r.o.", "company", "Sprostredkovateľ"],
  ["j", "Milan Dvorák", "person", "Príjemca hotovosti"],
  ["k", "Nordline, s.r.o.", "company", "Obchodný partner"],
  ["l", "Elena Horváthová", "person", "Splnomocnenkyňa"],
] as const;

function buildEntities(): CaseEntity[] {
  return entityDefinitions.map(([id, name, kind, role], index) => ({
    id,
    name,
    kind,
    role,
    country: id === "b" ? "CZ" : "SK",
    ...(id === "b" ? { ico: "12345678" } : {}),
    position: {
      x: 100 + (index % 4) * 220,
      y: 100 + Math.floor(index / 4) * 170,
    },
    intelligence: {
      verified: true,
      source: id === "b" ? "ares_cz" : "whoiswho_sk",
      riskScore: id === "a" ? 94 : id === "b" || id === "f" ? 88 : 28,
      isShellCompany: id === "b",
      taxDebtor: id === "a",
      inBankruptcy: id === "a",
      inRestructuring: false,
      taxDebts:
        id === "a"
          ? [
              {
                authority: "Finančné riaditeľstvo SR",
                amount: 42000,
                currency: "EUR",
              },
            ]
          : [],
      executions:
        id === "f"
          ? [{ reference: "EX-2025/118", status: "prebiehajúca" }]
          : [],
    },
  }));
}

const flows: Array<[string, string, number, string, string[]]> = [
  ["a", "b", 120000, "2026-01-14", ["podozrivý prevod"]],
  ["b", "c", 118000, "2026-01-15", ["round-tripping"]],
  ["c", "a", 116000, "2026-01-17", ["round-tripping"]],
  ["a", "j", 50000, "2026-03-28", ["hotovostný výber", "3 dni pred konkurzom"]],
  ["a", "g", 18000, "2026-02-02", []],
  ["g", "b", 17500, "2026-02-04", ["prepojený dodávateľ"]],
  ["b", "f", 24000, "2026-02-11", ["biely kôň"]],
  ["f", "h", 23000, "2026-02-12", ["podozrivý prevod"]],
  ["h", "i", 22000, "2026-02-13", []],
  ["i", "a", 21500, "2026-02-14", ["návrat finančných prostriedkov"]],
  ["a", "k", 15500, "2026-02-20", []],
  ["k", "l", 15000, "2026-02-21", ["nezvyčajný príjemca"]],
  ["l", "b", 14500, "2026-02-22", ["prepojený subjekt"]],
  ["e", "i", 9000, "2026-03-03", ["osobný prevod"]],
  ["d", "b", 8500, "2026-03-10", ["osobný prevod"]],
];

function sourceRef(index: number) {
  return {
    documentId: DOCUMENT_ID,
    page: Math.floor(index / 2) + 1,
    paragraph: (index % 3) + 1,
    excerpt: `Fiktívny dôkazný záznam č. ${index + 1} k vzorovej kauze.`,
  };
}

function buildTransactions(): CaseTransaction[] {
  return flows.map(
    ([fromEntityId, toEntityId, amount, date, anomalies], index) => ({
      id: `demo-tx-${index + 1}`,
      documentId: DOCUMENT_ID,
      date,
      amount,
      currency: "EUR",
      fromEntityId,
      toEntityId,
      method: index === 3 ? "cash" : "transfer",
      description:
        index === 3
          ? "Výber hotovosti z pokladne"
          : "Fiktívny demonštračný prevod",
      anomalies,
      sourceRef: sourceRef(index),
    }),
  );
}

function buildTimeline(): CaseTimelineEvent[] {
  const events = [
    [
      "2026-01-10",
      "Uzavretie rámcovej zmluvy",
      "Začiatok sledovaného obdobia.",
      "medium",
    ],
    [
      "2026-01-14",
      "Prvý prevod z Orion Holding",
      "Odchod 120 000 EUR na Vektor Consulting.",
      "high",
    ],
    [
      "2026-01-17",
      "Návrat peňazí do Orion Holding",
      "Dokončenie A → B → C → A schémy.",
      "critical",
    ],
    [
      "2026-02-11",
      "Platba bielemu koňovi",
      "Vektor Consulting platí Petrovi Bielemu.",
      "high",
    ],
    [
      "2026-02-22",
      "Presun cez splnomocnenkyňu",
      "Prostriedky smerujú späť do schránkovej firmy.",
      "high",
    ],
    [
      "2026-03-28",
      "Hotovostný výber 50 000 EUR",
      "Výber prebehol tri dni pred konkurzom.",
      "critical",
    ],
    [
      "2026-03-31",
      "Vyhlásenie konkurzu",
      "Materská spoločnosť vstupuje do konkurzu.",
      "critical",
    ],
    [
      "2026-04-06",
      "Zaistenie listinných dôkazov",
      "Zápisnica obsahuje záznamy o prevodoch.",
      "medium",
    ],
  ] as const;
  return events.map(([timestamp, title, detail, severity], index) => ({
    id: `demo-event-${index + 1}`,
    timestamp,
    title,
    detail,
    severity,
    involvedEntityIds: index < 3 ? ["a", "b", "c"] : ["a", "f"],
    chainBreak: severity === "critical",
    sourceRef: sourceRef(index + 7),
  }));
}

export function buildGoldenDemoCase(): ForensicCaseUnified {
  const transactions = buildTransactions();
  return {
    metadata: {
      id: GOLDEN_DEMO_CASE_ID,
      userId: "demo",
      name: "Spis ČVS: PPZ-442/2026 — Rekonštrukcia účelového vyvedenia aktív (350 000 €)",
      subtitle: "Syntetická prezentácia; nejde o reálny spis ani osoby.",
      referenceDate: "2026-03-31",
      baseCurrency: "EUR",
      sha256Hash: HASH,
      status: "analyzed",
      tags: ["demo", "round-tripping", "syntetické dáta"],
      createdAt: "2026-04-06T09:00:00.000Z",
      updatedAt: "2026-04-06T09:00:00.000Z",
      isDemo: true,
    },
    documents: [
      {
        id: DOCUMENT_ID,
        name: "Zápisnica o zaistení listín — vzorová kauza.pdf",
        size: 245760,
        mimeType: "application/pdf",
        sha256: HASH,
        classification: "court_dossier",
        ocrStatus: "completed",
        usedOcr: false,
        pageCount: 8,
        extractedText:
          "Syntetický dokument určený výhradne na produktovú prezentáciu.",
        hashBasis: "extracted_text",
        passages: Array.from({ length: 16 }, (_, index) => ({
          page: Math.floor(index / 2) + 1,
          paragraph: (index % 3) + 1,
          text: `Fiktívny dôkazný záznam č. ${index + 1} k vzorovej kauze.`,
        })),
      },
    ],
    entities: buildEntities(),
    transactions,
    relationships: transactions.map((transaction) => ({
      id: `demo-rel-${transaction.id}`,
      fromEntityId: transaction.fromEntityId,
      toEntityId: transaction.toEntityId,
      type: "money_flow",
      label: `${transaction.amount.toLocaleString("sk-SK")} EUR`,
      weight: transaction.amount,
      sourceRef: transaction.sourceRef?.excerpt,
    })),
    timeline: buildTimeline(),
    dossierSummary: {
      defendabilityIndex: 28,
      overallRisk: "KRITICKÉ",
      defenseAttacks: [
        "Overiť ekonomický dôvod prevodov v uzavretom cykle A → B → C → A.",
        "Vyžiadať pokladničné doklady k výberu 50 000 EUR pred konkurzom.",
      ],
      judgeReadyText:
        "Vzorový prípad poukazuje na opakované presuny prostriedkov medzi prepojenými subjektmi a hotovostný výber tesne pred konkurzom.",
    },
  };
}

export const getGoldenDemoCase = buildGoldenDemoCase;
