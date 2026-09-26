export type Severity = "critical" | "high" | "medium" | "low";

/**
 * Trieda zistenia:
 * - `fakt` — priamo pozorovaná hodnota v zadaných dátach,
 * - `heuristika` — interpretácia podľa prahu alebo vzoru,
 * - `hypotéza` — návrh na overenie (rezervované pre budúcu AI vrstvu).
 */
export type FindingKind = "fakt" | "heuristika" | "hypotéza";

export type EvidenceRef = {
  type:
    | "entity"
    | "transaction"
    | "weapon"
    | "relation"
    | "event"
    | "import"
    | "document"
    | "registry"
    | "cross-border-analysis"
    | "company-profile";
  id: string;
};

export type DataSource =
  | "manual"
  | "csv-import"
  | "document"
  | "ico-atlas"
  | "orsr"
  | "dimitri-checker"
  | "ai"
  | "whoiswho"
  | "ares";

export type SourceRecord = {
  id: string;
  source: DataSource;
  sourceVersion?: string | undefined;
  sourceUrl?: string | undefined;
  capturedAt: string;
  sourceHash?: string | undefined;
  /** Confidence je číslo od 0 do 100 */
  confidence?: number | undefined;
  rawReference?: string | undefined;
};

export type Flag = {
  /** Stabilný identifikátor pravidla (nemení sa medzi verziami). */
  code: string;
  label: string;
  detail: string;
  weight: number;
  severity: Severity;
  ruleId?: string | undefined;
  ruleVersion?: string | undefined;
  kind?: FindingKind | undefined;
  /** Konkrétne zdrojové záznamy, ktoré pravidlo spustili. */
  evidence?: EvidenceRef[] | undefined;
  /** Spúšťacia podmienka vrátane prahu. */
  condition?: string | undefined;
  /** Použité hodnoty, z ktorých podmienka vyšla. */
  values?: Record<string, string | number> | undefined;
};

export type EntityKind = "person" | "company";

export type Entity = {
  id: string;
  name: string;
  kind: EntityKind;
  role: string;
  ico?: string | undefined;
  address?: string | undefined;
  /** Adresa evidovaná v ORSR (mock referenčná databáza). */
  registeredAddress?: string | undefined;
  licence?: string | undefined;
  incorporatedAt?: string | undefined;
  physicalInventory?: boolean | undefined;
  responsive?: boolean | undefined;
  country: string;
  x: number;
  y: number;
  note?: string | undefined;
};

export type PaymentMethod = "cash" | "transfer";

export type Transaction = {
  id: string;
  date: string;
  /** Podpísaná suma v mene transakcie; kladná = tok fromId → toId. */
  amount: number;
  /** ISO 4217 kód meny (napr. EUR). Rôzne meny sa nikdy nesčítavajú. */
  currency: string;
  method: PaymentMethod;
  fromId: string;
  toId: string;
  /** Skutočný platiteľ, ak sa líši od zmluvnej strany (platba tretej strany). */
  payerId?: string | undefined;
  originCountry: string;
  destinationCountry: string;
  description: string;
  /** Import, z ktorého transakcia vznikla (ak nebola zadaná ručne). */
  importId?: string | undefined;
  /** Číslo riadka v pôvodnom súbore — dohľadateľnosť zdroja. */
  sourceRow?: number | undefined;
};

export type Weapon = {
  id: string;
  brand: string;
  model: string;
  serial: string;
  holderId: string;
  supplierId: string;
  acquiredAt: string;
  licence?: string | undefined;
};

export type Relation = {
  fromId: string;
  toId: string;
  label: string;
};

export type CaseEvent = {
  date: string;
  title: string;
  detail: string;
  severity: Severity;
};

export type ForensicCase = {
  id: string;
  name: string;
  subtitle: string;
  referenceDate: string;
  /** Základná mena prípadu — objemové ukazovatele sa počítajú v nej. */
  baseCurrency: string;
  entities: Entity[];
  transactions: Transaction[];
  weapons: Weapon[];
  relations: Relation[];
  events: CaseEvent[];
  /** Mock referenčné databázy. */
  europolSerials: string[];
  validLicences: string[];
  orsrAddresses: Record<string, string>;
};

export type EntityAnalysis = {
  entity: Entity;
  flags: Flag[];
  score: number;
  level: Severity;
  isShell: boolean;
  weaponCount: number;
  totalVolume: number;
};

export type TransactionAnalysis = {
  transaction: Transaction;
  flags: Flag[];
  score: number;
  level: Severity;
};

export type WeaponAnalysis = {
  weapon: Weapon;
  flags: Flag[];
  europolMatch: boolean;
  invalidLicence: boolean;
  europolRecord?: EuropolRecord;
  fuzzyMatch?: boolean;
};

export type TraffickingChain = {
  shellId: string;
  supplierIds: string[];
  buyerIds: string[];
  severity: Severity;
};

export type CrossBorderAlert = {
  transactionId: string;
  route: string;
  amount: number;
  score: number;
};

export type EuropolRecord = {
  serial: string;
  seizedCountry: string;
  seizedAt: string;
  caseRef: string;
  context: string;
  status: "seized" | "wanted" | "crime_scene";
};

/** Vystopovaná trasa peňazí cez viacero subjektov. */
export type MoneyPath = {
  id: string;
  entityIds: string[];
  transactionIds: string[];
  hops: number;
  amount: number;
  spanDays: number;
  viaShellIds: string[];
  crossesBorder: boolean;
  returnsToOrigin: boolean;
  score: number;
  severity: Severity;
};

export type LaunderingSignal = {
  code: string;
  entityId: string;
  label: string;
  detail: string;
  score: number;
  severity: Severity;
};

export type TemporalPattern = {
  code: string;
  label: string;
  detail: string;
  transactionIds: string[];
  score: number;
  severity: Severity;
};

export type Corridor = {
  route: string;
  originCountry: string;
  destinationCountry: string;
  count: number;
  amount: number;
  highRisk: boolean;
  score: number;
  severity: Severity;
};

export type Alert = {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  score: number;
  source:
    | "entita"
    | "transakcia"
    | "zbraň"
    | "sieť"
    | "cezhraničné"
    | "pranie peňazí"
    | "časový vzor";
  date?: string;
};

export type CaseAnalysis = {
  case: ForensicCase;
  entities: EntityAnalysis[];
  transactions: TransactionAnalysis[];
  weapons: WeaponAnalysis[];
  chains: TraffickingChain[];
  crossBorder: CrossBorderAlert[];
  moneyPaths: MoneyPath[];
  launderingSignals: LaunderingSignal[];
  temporalPatterns: TemporalPattern[];
  corridors: Corridor[];
  alerts: Alert[];
  caseScore: number;
  caseLevel: Severity;
  topFlags: Flag[];
  /** Verzia sady pravidiel, ktorou bol výsledok vypočítaný. */
  rulesVersion: string;
  /** Deterministický odtlačok analyzovaných dát (nezávislý od času a rozloženia grafu). */
  dataFingerprint: string;
  totals: {
    entities: number;
    companies: number;
    transactions: number;
    /** Objem v základnej mene prípadu (absolútne hodnoty). */
    volume: number;
    /** Objem podľa jednotlivých mien — bez konverzie. */
    volumeByCurrency: Record<string, number>;
    currencies: string[];
    cashRatio: number;
    weapons: number;
    europolMatches: number;
  };
};
