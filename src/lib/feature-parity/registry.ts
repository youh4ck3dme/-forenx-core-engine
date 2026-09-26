/**
 * Register funkcií pôvodnej aplikácie ForenX.
 *
 * Slúži ako jediný zdroj pravdy pre automatizovaný kontrolný zoznam parity:
 * pri prenose aplikácie do novej implementácie sa tento register nemení — mení
 * sa len kód. Testy potom ukážu, ktorý workflow, oprávnenie alebo validácia
 * v novej implementácii chýba.
 */

export type WorkflowStage =
  | "pripady"
  | "nahravanie"
  | "workspace"
  | "zistenia"
  | "export"
  | "ucet"
  | "prevadzka";

export type FeatureSpec = {
  /** Stabilný identifikátor funkcie (nemení sa medzi implementáciami). */
  id: string;
  /** Slovenský názov pre kontrolný zoznam. */
  label: string;
  /** Fáza používateľského toku. */
  stage: WorkflowStage;
  /** URL cesta, na ktorej funkcia žije (ak má vlastnú obrazovku). */
  route?: string;
  /** Vyžaduje prihlásenie (chránená vetva `_authenticated`). */
  requiresAuth: boolean;
  /** Súbory, ktoré musia v implementácii existovať. */
  files: string[];
  /** Symboly, ktoré musia byť v danom súbore prítomné. */
  symbols?: { file: string; symbol: string }[];
  /** Tabuľky, ktoré funkcia číta alebo zapisuje (kontrola RLS). */
  tables?: string[];
  /** Validácie vstupu, ktoré musia byť v kóde prítomné. */
  validations?: { file: string; symbol: string; note: string }[];
};

/** Tabuľky, ktoré musia mať vlastnícke RLS politiky pre všetky štyri operácie. */
export const OWNER_SCOPED_TABLES = [
  "cases",
  "case_entities",
  "case_transactions",
  "case_weapons",
  "case_relations",
  "case_events",
  "case_imports",
] as const;

/** Tabuľky, ktoré smú byť len na čítanie pre vlastníka (zápis iba zo servera). */
export const READ_ONLY_TABLES = [
  "ai_feature_logs",
  "error_logs",
  "user_roles",
  "subscriptions",
] as const;

export const FEATURE_REGISTRY: FeatureSpec[] = [
  {
    id: "auth.sign-in",
    label: "Prihlásenie, registrácia a obnova hesla",
    stage: "pripady",
    route: "/auth",
    requiresAuth: false,
    files: [
      "src/routes/auth.tsx",
      "src/components/malte/AccountSignInForm.tsx",
    ],
    symbols: [
      { file: "src/components/malte/AccountSignInForm.tsx", symbol: "signUp" },
      {
        file: "src/components/malte/AccountSignInForm.tsx",
        symbol: "resetPasswordForEmail",
      },
    ],
  },
  {
    id: "auth.route-guard",
    label: "Ochrana chránených obrazoviek a vypršanie relácie",
    stage: "prevadzka",
    requiresAuth: true,
    files: [
      "src/routes/_authenticated/route.tsx",
      "src/lib/session-guard.ts",
      "src/lib/session-expired.ts",
    ],
    symbols: [
      {
        file: "src/routes/_authenticated/route.tsx",
        symbol: "notifySessionExpired",
      },
      {
        file: "src/lib/session-guard.ts",
        symbol: "beginIntentionalSignOut",
      },
    ],
  },
  {
    id: "cases.list",
    label: "Zoznam prípadov s pagináciou a vlastníctvom",
    stage: "pripady",
    route: "/pripady",
    requiresAuth: true,
    files: ["src/routes/_authenticated/pripady.tsx", "src/lib/case-data.ts"],
    symbols: [{ file: "src/lib/case-data.ts", symbol: "listCases" }],
    tables: ["cases"],
  },
  {
    id: "cases.create",
    label: "Vytvorenie nového prípadu",
    stage: "pripady",
    requiresAuth: true,
    files: ["src/components/malte/NewCaseForm.tsx"],
    tables: ["cases"],
  },
  {
    id: "upload.quick",
    label: "Rýchle nahranie dokumentu z prehľadu (aj fotoaparát a HEIC)",
    stage: "nahravanie",
    route: "/prehlad",
    requiresAuth: true,
    files: [
      "src/components/malte/QuickUploadCard.tsx",
      "src/lib/upload-prep.ts",
    ],
    symbols: [{ file: "src/lib/upload-prep.ts", symbol: "toUploadPayload" }],
    validations: [
      {
        file: "src/lib/upload-prep.ts",
        symbol: "MAX_UPLOAD_BYTES",
        note: "strop veľkosti súboru",
      },
    ],
  },
  {
    id: "upload.sandbox",
    label: "Sandbox: viac dokumentov, priebeh a AI analýza",
    stage: "nahravanie",
    route: "/sandbox",
    requiresAuth: true,
    files: [
      "src/routes/_authenticated/sandbox.tsx",
      "src/components/malte/ProcessingOverlay.tsx",
      "src/lib/processing-progress.ts",
    ],
    symbols: [
      { file: "src/lib/processing-progress.ts", symbol: "PROCESSING_COPY" },
    ],
  },
  {
    id: "upload.limits",
    label: "Serverové limity nahrávania (veľkosť, počet súborov)",
    stage: "nahravanie",
    requiresAuth: true,
    files: ["src/lib/ai.functions.ts"],
    validations: [
      {
        file: "src/lib/ai.functions.ts",
        symbol: "UPLOAD_MAX_FILES",
        note: "max. počet súborov",
      },
      {
        file: "src/lib/ai.functions.ts",
        symbol: "UPLOAD_MAX_BASE64_CHARS",
        note: "max. veľkosť binárneho obsahu",
      },
      {
        file: "src/lib/ai.functions.ts",
        symbol: "UPLOAD_MAX_TEXT_CHARS",
        note: "max. dĺžka textu",
      },
    ],
  },
  {
    id: "import.csv",
    label: "Import CSV výpisov s mapovaním stĺpcov",
    stage: "nahravanie",
    route: "/import-csv",
    requiresAuth: true,
    files: [
      "src/routes/_authenticated/import-csv.tsx",
      "src/lib/csv/parse.ts",
      "src/lib/csv/mapping.ts",
      "src/lib/import.functions.ts",
    ],
    tables: ["case_imports", "case_transactions"],
  },
  {
    id: "ai.consent",
    label: "Súhlas pred odoslaním spisu externej AI",
    stage: "workspace",
    requiresAuth: true,
    files: [
      "src/components/malte/AiConsentDialog.tsx",
      "src/lib/ai-consent.ts",
      "src/lib/ai/redact.ts",
    ],
    symbols: [{ file: "src/lib/ai/redact.ts", symbol: "buildAiPayload" }],
  },
  {
    id: "ai.analysis",
    label: "Hĺbková AI analýza spisu s delením na časti",
    stage: "workspace",
    requiresAuth: true,
    files: [
      "src/lib/ai.functions.ts",
      "src/lib/ai-prompt.ts",
      "src/lib/forensic-dossier.merge.ts",
      "src/lib/forensic-dossier.schema.ts",
    ],
    symbols: [
      { file: "src/lib/ai-prompt.ts", symbol: "splitDocumentForAutopilot" },
      {
        file: "src/lib/forensic-dossier.merge.ts",
        symbol: "mergeForensicDossiers",
      },
    ],
    validations: [
      {
        file: "src/lib/forensic-dossier.schema.ts",
        symbol: "parseForensicDossier",
        note: "validácia JSON výstupu AI",
      },
      {
        file: "src/lib/forensic-dossier.schema.ts",
        symbol: "repairTruncatedJson",
        note: "oprava useknutej odpovede",
      },
    ],
    tables: ["ai_feature_logs"],
  },
  {
    id: "ai.logging",
    label: "Logovanie každého AI volania",
    stage: "prevadzka",
    requiresAuth: true,
    files: ["src/lib/ai-log.server.ts"],
    tables: ["ai_feature_logs"],
  },
  {
    id: "ai.assistant",
    label: "Asistent s právnym upozornením nad výstupom",
    stage: "zistenia",
    route: "/asistent",
    requiresAuth: true,
    files: [
      "src/routes/_authenticated/asistent.tsx",
      "src/components/malte/Assistant.tsx",
      "src/config/brand.ts",
    ],
    symbols: [
      { file: "src/components/malte/Assistant.tsx", symbol: "AI_DISCLAIMER" },
      { file: "src/config/brand.ts", symbol: "Výstup AI nie je dôkaz" },
    ],
  },
  {
    id: "workspace.overview",
    label: "Prehľad prípadu s rizikovým skóre",
    stage: "workspace",
    route: "/prehlad",
    requiresAuth: true,
    files: [
      "src/routes/_authenticated/prehlad.tsx",
      "src/components/malte/RiskGauge.tsx",
    ],
  },
  {
    id: "findings.analysis",
    label: "Analýza výpisov a zistenia so zdrojmi",
    stage: "zistenia",
    route: "/analyza-vypisov",
    requiresAuth: true,
    files: [
      "src/routes/_authenticated/analyza-vypisov.tsx",
      "src/forensic/index.ts",
    ],
    symbols: [{ file: "src/forensic/index.ts", symbol: "analyzeCase" }],
  },
  {
    id: "findings.entities",
    label: "Osoby a firmy",
    stage: "zistenia",
    route: "/osoby",
    requiresAuth: true,
    files: ["src/routes/_authenticated/osoby.tsx"],
    tables: ["case_entities"],
  },
  {
    id: "findings.relations",
    label: "Vzťahy medzi subjektmi",
    stage: "zistenia",
    route: "/vztahy",
    requiresAuth: true,
    files: ["src/routes/_authenticated/vztahy.tsx"],
    tables: ["case_relations"],
  },
  {
    id: "findings.network",
    label: "Sieť tokov s grafom a limitom uzlov",
    stage: "zistenia",
    route: "/siet",
    requiresAuth: true,
    files: [
      "src/routes/_authenticated/siet.tsx",
      "src/components/malte/NetworkGraph.tsx",
    ],
    tables: ["case_transactions", "case_relations"],
  },
  {
    id: "findings.weapons",
    label: "Zbrane a držitelia",
    stage: "zistenia",
    route: "/zbrane",
    requiresAuth: true,
    files: ["src/routes/_authenticated/zbrane.tsx"],
    tables: ["case_weapons"],
  },
  {
    id: "findings.legal",
    label: "Právny kontext a paragrafy",
    stage: "zistenia",
    route: "/pravny-kontext",
    requiresAuth: true,
    files: [
      "src/routes/_authenticated/pravny-kontext.tsx",
      "src/forensic/legal/laws.ts",
    ],
  },
  {
    id: "export.pdf",
    label: "Export správy do PDF so SHA-256 a upozornením",
    stage: "export",
    requiresAuth: true,
    files: ["src/lib/export-pdf.ts", "src/lib/report.ts"],
    symbols: [
      { file: "src/lib/export-pdf.ts", symbol: "sha256Hex" },
      { file: "src/lib/export-pdf.ts", symbol: "AI_DISCLAIMER" },
    ],
  },
  {
    id: "account.profile",
    label: "Profil používateľa",
    stage: "ucet",
    route: "/profil",
    requiresAuth: true,
    files: [
      "src/routes/_authenticated/profil.tsx",
      "src/lib/profile.functions.ts",
    ],
    tables: ["profiles"],
  },
  {
    id: "account.billing",
    label: "Predplatné a platby",
    stage: "ucet",
    route: "/predplatne",
    requiresAuth: true,
    files: [
      "src/routes/_authenticated/predplatne.tsx",
      "src/lib/payments.functions.ts",
    ],
    tables: ["subscriptions"],
  },
  {
    id: "account.privacy",
    label: "Súkromie a zmazanie údajov",
    stage: "ucet",
    route: "/sukromie",
    requiresAuth: true,
    files: ["src/routes/_authenticated/sukromie.tsx"],
  },
  {
    id: "ops.health",
    label: "Health-check endpoint s obmedzením požiadaviek",
    stage: "prevadzka",
    route: "/api/public/health",
    requiresAuth: false,
    files: ["src/routes/api/public/health.ts", "src/lib/health.functions.ts"],
  },
  {
    id: "ops.status",
    label: "Admin obrazovka Stav systému a posledné chyby",
    stage: "prevadzka",
    route: "/stav",
    requiresAuth: true,
    files: ["src/routes/_authenticated/stav.tsx"],
    tables: ["error_logs"],
  },
  {
    id: "ops.error-logging",
    label: "Štruktúrované logovanie chýb zo servera aj klienta",
    stage: "prevadzka",
    requiresAuth: false,
    files: [
      "src/lib/error-log.server.ts",
      "src/lib/error-log.functions.ts",
      "src/lib/error-capture.ts",
    ],
    tables: ["error_logs"],
  },
  {
    id: "pwa.offline",
    label: "PWA: manifest, servisný worker a offline pruh",
    stage: "prevadzka",
    requiresAuth: false,
    files: ["src/sw.ts", "src/lib/pwa.ts", "src/hooks/useOnlineStatus.ts"],
  },
];
