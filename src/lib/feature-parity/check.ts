/**
 * Automatizovaná kontrola parity funkcií.
 *
 * Čisté funkcie — súborový systém sa odovzdáva ako jednoduché rozhranie, takže
 * kontrolu možno spustiť nad reálnym repozitárom aj nad testovacím zoznamom.
 */
import {
  FEATURE_REGISTRY,
  OWNER_SCOPED_TABLES,
  READ_ONLY_TABLES,
  type FeatureSpec,
} from "./registry";

export type FileSystemLike = {
  exists: (path: string) => boolean;
  read: (path: string) => string;
  listMigrations: () => { path: string; sql: string }[];
};

export type FindingKind =
  | "chýbajúci súbor"
  | "chýbajúci workflow"
  | "chýbajúca validácia"
  | "chýbajúce oprávnenie";

export type Finding = {
  featureId: string;
  label: string;
  kind: FindingKind;
  detail: string;
};

export type FeatureResult = {
  feature: FeatureSpec;
  ok: boolean;
  findings: Finding[];
};

export type ParityReport = {
  results: FeatureResult[];
  findings: Finding[];
  total: number;
  passed: number;
};

const SQL_COMMANDS = ["select", "insert", "update", "delete"] as const;
export type SqlCommand = (typeof SQL_COMMANDS)[number];

/** Mapa tabuľka → množina povolených operácií podľa RLS politík v migráciách. */
export function collectPolicies(
  migrations: { path: string; sql: string }[],
): Map<string, Set<SqlCommand>> {
  // názov politiky → { table, commands }
  const live = new Map<string, { table: string; commands: SqlCommand[] }>();

  const createRe =
    /create\s+policy\s+"([^"]+)"\s*\n?\s*on\s+(?:public\.)?([a-z0-9_]+)\s+for\s+(all|select|insert|update|delete)/gi;
  const dropRe =
    /drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+(?:public\.)?([a-z0-9_]+)/gi;

  for (const migration of migrations) {
    const sql = migration.sql;
    // Spracujeme príkazy v poradí, v akom sa v súbore nachádzajú.
    type Op = { index: number; type: "create" | "drop"; args: string[] };
    const ops: Op[] = [];
    for (const m of sql.matchAll(createRe)) {
      ops.push({
        index: m.index ?? 0,
        type: "create",
        args: [
          m[1] ?? "",
          (m[2] ?? "").toLowerCase(),
          (m[3] ?? "").toLowerCase(),
        ],
      });
    }
    for (const m of sql.matchAll(dropRe)) {
      ops.push({
        index: m.index ?? 0,
        type: "drop",
        args: [m[1] ?? "", (m[2] ?? "").toLowerCase()],
      });
    }
    ops.sort((a, b) => a.index - b.index);

    for (const op of ops) {
      const key = `${op.args[1]}::${op.args[0]}`;
      if (op.type === "drop") {
        live.delete(key);
        continue;
      }
      const command = op.args[2] as SqlCommand | "all";
      live.set(key, {
        table: op.args[1] ?? "",
        commands: command === "all" ? [...SQL_COMMANDS] : [command],
      });
    }
  }

  const byTable = new Map<string, Set<SqlCommand>>();
  for (const entry of live.values()) {
    const set = byTable.get(entry.table) ?? new Set<SqlCommand>();
    for (const command of entry.commands) set.add(command);
    byTable.set(entry.table, set);
  }
  return byTable;
}

/** Odvodí možné umiestnenia súboru route podľa URL cesty. */
export function routeFileCandidates(
  route: string,
  requiresAuth: boolean,
): string[] {
  const clean = route.replace(/^\//, "");
  if (clean.startsWith("api/")) {
    return [`src/routes/${clean}.ts`, `src/routes/${clean}.tsx`];
  }
  const base = requiresAuth
    ? `src/routes/_authenticated/${clean}`
    : `src/routes/${clean}`;
  return [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`];
}

function checkFeature(
  feature: FeatureSpec,
  fs: FileSystemLike,
  policies: Map<string, Set<SqlCommand>>,
): FeatureResult {
  const findings: Finding[] = [];
  const add = (kind: FindingKind, detail: string) =>
    findings.push({
      featureId: feature.id,
      label: feature.label,
      kind,
      detail,
    });

  if (feature.route) {
    const candidates = routeFileCandidates(feature.route, feature.requiresAuth);
    if (!candidates.some((path) => fs.exists(path))) {
      add(
        "chýbajúci workflow",
        `obrazovka ${feature.route} neexistuje (hľadané: ${candidates.join(", ")})`,
      );
    }
  }

  for (const file of feature.files) {
    if (!fs.exists(file)) {
      add("chýbajúci súbor", `chýba ${file}`);
    }
  }

  for (const { file, symbol } of feature.symbols ?? []) {
    if (!fs.exists(file)) continue; // už hlásené vyššie
    if (!fs.read(file).includes(symbol)) {
      add("chýbajúci workflow", `v ${file} chýba „${symbol}“`);
    }
  }

  for (const validation of feature.validations ?? []) {
    if (!fs.exists(validation.file)) continue;
    if (!fs.read(validation.file).includes(validation.symbol)) {
      add(
        "chýbajúca validácia",
        `${validation.note} — v ${validation.file} chýba „${validation.symbol}“`,
      );
    }
  }

  for (const table of feature.tables ?? []) {
    const allowed = policies.get(table);
    if (!allowed || allowed.size === 0) {
      add("chýbajúce oprávnenie", `tabuľka ${table} nemá žiadnu RLS politiku`);
      continue;
    }
    if ((OWNER_SCOPED_TABLES as readonly string[]).includes(table)) {
      for (const command of SQL_COMMANDS) {
        if (!allowed.has(command)) {
          add(
            "chýbajúce oprávnenie",
            `tabuľka ${table} nemá vlastnícku politiku pre ${command.toUpperCase()}`,
          );
        }
      }
    }
    if (
      (READ_ONLY_TABLES as readonly string[]).includes(table) &&
      !allowed.has("select")
    ) {
      add("chýbajúce oprávnenie", `tabuľka ${table} nemá politiku pre SELECT`);
    }
  }

  return { feature, ok: findings.length === 0, findings };
}

export function runParityCheck(
  fs: FileSystemLike,
  registry: FeatureSpec[] = FEATURE_REGISTRY,
): ParityReport {
  const policies = collectPolicies(fs.listMigrations());
  const results = registry.map((feature) =>
    checkFeature(feature, fs, policies),
  );
  return {
    results,
    findings: results.flatMap((result) => result.findings),
    total: results.length,
    passed: results.filter((result) => result.ok).length,
  };
}

/** Markdown kontrolný zoznam pre ľudskú kontrolu. */
export function renderChecklist(report: ParityReport): string {
  const stages = new Map<string, FeatureResult[]>();
  for (const result of report.results) {
    const list = stages.get(result.feature.stage) ?? [];
    list.push(result);
    stages.set(result.feature.stage, list);
  }

  const lines: string[] = [
    "# Kontrolný zoznam parity funkcií ForenX",
    "",
    `Splnené: **${report.passed} / ${report.total}** funkcií. Nálezy: **${report.findings.length}**.`,
    "",
  ];

  for (const [stage, results] of stages) {
    lines.push(`## Fáza: ${stage}`, "");
    for (const result of results) {
      const route = result.feature.route
        ? ` — \`${result.feature.route}\``
        : "";
      lines.push(
        `- [${result.ok ? "x" : " "}] ${result.feature.label}${route}`,
      );
      for (const finding of result.findings) {
        lines.push(`  - ⚠️ ${finding.kind}: ${finding.detail}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
