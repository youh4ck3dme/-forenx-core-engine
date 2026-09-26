// Serverové funkcie pre administrátorský prehľad stavu systému.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DbHealth = {
  max_connections: number;
  total_connections: number;
  active_connections: number;
  idle_connections: number;
  idle_in_transaction: number;
  waiting_connections: number;
  database_size_bytes: number;
  postgres_version: string;
};

export type AiFeatureStat = {
  feature: string;
  total: number;
  failures: number;
  avgDurationMs: number | null;
  lastAt: string | null;
};

export type AiInvocation = {
  id: string;
  created_at: string;
  feature: string;
  success: boolean;
  duration_ms: number | null;
  provider: string | null;
  model: string | null;
  error_message: string | null;
  input_summary: string | null;
};

export type SystemErrorLog = {
  id: string;
  created_at: string;
  route: string | null;
  message: string;
  severity: string;
  source: string;
};

export type SystemCheckStatus = "ok" | "warning" | "problem" | "unknown";

export type SystemCheck = {
  id: string;
  label: string;
  detail: string;
  status: SystemCheckStatus;
};

export type SystemHealth = {
  checkedAt: string;
  database: {
    ok: boolean;
    latencyMs: number;
    error?: string;
    stats?: DbHealth;
  };
  ai: {
    windowHours: number;
    total: number;
    failures: number;
    avgDurationMs: number | null;
    byFeature: AiFeatureStat[];
    recent: AiInvocation[];
    error?: string;
  };
  errors: {
    recent: SystemErrorLog[];
    error?: string;
  };
  checks: SystemCheck[];
};

const WINDOW_HOURS = 24;

function buildSystemChecks({
  databaseOk,
  databaseLatencyMs,
  caseCount,
  stats,
  chatConfigured,
  analysisConfigured,
  aiLogsAvailable,
  aiTotal,
  aiFailures,
  errorLogsAvailable,
  storageOk,
  storageBucketCount,
}: {
  databaseOk: boolean;
  databaseLatencyMs: number;
  caseCount: number | null;
  stats?: DbHealth;
  chatConfigured: boolean;
  analysisConfigured: boolean;
  aiLogsAvailable: boolean;
  aiTotal: number;
  aiFailures: number;
  errorLogsAvailable: boolean;
  storageOk: boolean;
  storageBucketCount: number | null;
}): SystemCheck[] {
  const connectionUsage = stats
    ? Math.round(
        (stats.total_connections / Math.max(stats.max_connections, 1)) * 100,
      )
    : null;
  const aiFailureRate = aiTotal ? Math.round((aiFailures / aiTotal) * 100) : 0;

  return [
    {
      id: "application",
      label: "Aplikačný server",
      detail: "Administrátorský prehľad odpovedá.",
      status: "ok",
    },
    {
      id: "database",
      label: "Databáza PostgreSQL",
      detail: databaseOk
        ? "Pripojenie k databáze je funkčné."
        : "Databázový dotaz zlyhal.",
      status: databaseOk ? "ok" : "problem",
    },
    {
      id: "case-repository",
      label: "Úložisko spisov",
      detail:
        caseCount === null
          ? "Počet spisov sa nepodarilo overiť."
          : `Dotaz na evidenciu spisov funguje (${caseCount} záznamov).`,
      status: caseCount === null ? "problem" : "ok",
    },
    {
      id: "database-latency",
      label: "Odozva databázy",
      detail: `${databaseLatencyMs} ms${databaseLatencyMs >= 500 ? " — odozva je zvýšená." : ""}`,
      status: !databaseOk
        ? "problem"
        : databaseLatencyMs >= 500
          ? "warning"
          : "ok",
    },
    {
      id: "database-connections",
      label: "Limit pripojení databázy",
      detail: stats
        ? `${stats.total_connections} z ${stats.max_connections} pripojení je použitých.`
        : "Metrika PostgreSQL nie je k dispozícii.",
      status:
        connectionUsage === null
          ? "unknown"
          : connectionUsage >= 90
            ? "problem"
            : connectionUsage >= 80
              ? "warning"
              : "ok",
    },
    {
      id: "open-transactions",
      label: "Otvorené databázové transakcie",
      detail: stats
        ? `${stats.idle_in_transaction} nečinných pripojení v transakcii.`
        : "Metrika PostgreSQL nie je k dispozícii.",
      status:
        stats === undefined
          ? "unknown"
          : stats.idle_in_transaction > 0
            ? "warning"
            : "ok",
    },
    {
      id: "database-locks",
      label: "Čakanie na databázové zámky",
      detail: stats
        ? `${stats.waiting_connections} pripojení čaká na zámok.`
        : "Metrika PostgreSQL nie je k dispozícii.",
      status:
        stats === undefined
          ? "unknown"
          : stats.waiting_connections > 0
            ? "warning"
            : "ok",
    },
    {
      id: "database-capacity",
      label: "Veľkosť databázy",
      detail: stats
        ? `${Math.round(stats.database_size_bytes / 1024 / 1024)} MB využitého priestoru.`
        : "Metrika PostgreSQL nie je k dispozícii.",
      status: stats === undefined ? "unknown" : "ok",
    },
    {
      id: "document-storage",
      label: "Úložisko dokumentov",
      detail: storageOk
        ? `${storageBucketCount ?? 0} úložných priestorov je dostupných.`
        : "Úložisko dokumentov sa nepodarilo overiť.",
      status: storageOk ? "ok" : "problem",
    },
    {
      id: "ai-chat-configuration",
      label: "Mistral AI pre Copilota",
      detail: chatConfigured
        ? "Kľúč pre chat a kontroly je nakonfigurovaný."
        : "Chýba konfigurácia Mistral AI pre chat.",
      status: chatConfigured ? "ok" : "problem",
    },
    {
      id: "ai-analysis-configuration",
      label: "Mistral AI pre analýzu a OCR",
      detail: analysisConfigured
        ? "Kľúč pre analýzu dokumentov a OCR je nakonfigurovaný."
        : "Chýba konfigurácia Mistral AI pre analýzu a OCR.",
      status: analysisConfigured ? "ok" : "problem",
    },
    {
      id: "ai-telemetry",
      label: "Telemetria AI volaní",
      detail: aiLogsAvailable
        ? "Záznamy AI volaní sa dajú načítať."
        : "Záznamy AI volaní sa nepodarilo načítať.",
      status: aiLogsAvailable ? "ok" : "problem",
    },
    {
      id: "ai-reliability",
      label: "Úspešnosť AI za 24 hodín",
      detail: aiTotal
        ? `${aiFailures} z ${aiTotal} volaní zlyhalo (${aiFailureRate} %).`
        : "Za posledných 24 hodín neprebehlo žiadne AI volanie.",
      status:
        aiFailureRate >= 25 ? "problem" : aiFailureRate > 0 ? "warning" : "ok",
    },
    {
      id: "error-logging",
      label: "Záznam systémových chýb",
      detail: errorLogsAvailable
        ? "Chybové udalosti sa dajú načítať."
        : "Záznam chýb sa nepodarilo overiť.",
      status: errorLogsAvailable ? "ok" : "problem",
    },
    {
      id: "pdf-export",
      label: "Forenzný PDF export",
      detail:
        "Export je súčasťou tejto verzie; vytvára PDF a overovací SHA-256 manifest priamo v prehliadači.",
      status: "ok",
    },
  ];
}

/** Prehľad stavu databázy, pripojení a AI volaní. Len pre administrátora. */
export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemHealth> => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Overenie oprávnení zlyhalo.");
    if (!isAdmin) throw new Error("Prístup majú iba administrátori.");

    // 1) Dostupnosť a odozva databázy
    const started = Date.now();
    let dbOk = true;
    let dbError: string | undefined;
    const { count: caseCount, error: pingError } = await supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (pingError) {
      dbOk = false;
      dbError = pingError.message;
    }
    const latencyMs = Date.now() - started;

    // 2) Stav pripojení (pooler / Postgres)
    let stats: DbHealth | undefined;
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data: statsData, error: statsError } =
      await supabaseAdmin.rpc("db_health_stats");
    if (statsError) {
      dbError = dbError ?? statsError.message;
    } else if (statsData) {
      stats = statsData as unknown as DbHealth;
    }

    const { data: storageBuckets, error: storageError } =
      await supabaseAdmin.storage.listBuckets();

    // 3) AI volania za posledných 24 hodín
    const since = new Date(
      Date.now() - WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const ai: SystemHealth["ai"] = {
      windowHours: WINDOW_HOURS,
      total: 0,
      failures: 0,
      avgDurationMs: null,
      byFeature: [],
      recent: [],
    };

    const { data: logs, error: logsError } = await supabase
      .from("ai_feature_logs")
      .select(
        "id, created_at, feature, success, duration_ms, provider, model, error_message, input_summary",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    if (logsError) {
      ai.error = logsError.message;
    } else {
      const rows = (logs ?? []) as unknown as AiInvocation[];
      ai.total = rows.length;
      ai.failures = rows.filter((r) => !r.success).length;
      const durations = rows
        .map((r) => r.duration_ms)
        .filter((d): d is number => typeof d === "number");
      ai.avgDurationMs = durations.length
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
        : null;

      const map = new Map<string, { rows: AiInvocation[] }>();
      for (const row of rows) {
        const bucket = map.get(row.feature) ?? { rows: [] };
        bucket.rows.push(row);
        map.set(row.feature, bucket);
      }
      ai.byFeature = [...map.entries()]
        .map(([feature, bucket]) => {
          const d = bucket.rows
            .map((r) => r.duration_ms)
            .filter((v): v is number => typeof v === "number");
          return {
            feature,
            total: bucket.rows.length,
            failures: bucket.rows.filter((r) => !r.success).length,
            avgDurationMs: d.length
              ? Math.round(d.reduce((s, v) => s + v, 0) / d.length)
              : null,
            lastAt: bucket.rows[0]?.created_at ?? null,
          };
        })
        .sort((a, b) => b.total - a.total);
      ai.recent = rows.slice(0, 20);
    }

    const errors: SystemHealth["errors"] = { recent: [] };
    const { data: errorRows, error: errorLogsError } = await supabase
      .from("error_logs")
      .select("id, created_at, route, message, severity, source")
      .order("created_at", { ascending: false })
      .limit(5);

    if (errorLogsError) {
      errors.error = errorLogsError.message;
    } else {
      errors.recent = (errorRows ?? []) as SystemErrorLog[];
    }

    const fallbackKeyConfigured = Boolean(
      process.env["MISTRAL_API_KEY"]?.trim(),
    );
    const chatConfigured = Boolean(
      process.env["MISTRAL_API_KEY_CHAT"]?.trim() || fallbackKeyConfigured,
    );
    const analysisConfigured = Boolean(
      process.env["MISTRAL_API_KEY_ANALYSIS"]?.trim() || fallbackKeyConfigured,
    );

    return {
      checkedAt: new Date().toISOString(),
      database: {
        ok: dbOk,
        latencyMs,
        ...(dbError ? { error: dbError } : {}),
        ...(stats ? { stats } : {}),
      },
      ai,
      errors,
      checks: buildSystemChecks({
        databaseOk: dbOk,
        databaseLatencyMs: latencyMs,
        caseCount: pingError ? null : caseCount,
        ...(stats ? { stats } : {}),
        chatConfigured,
        analysisConfigured,
        aiLogsAvailable: !logsError,
        aiTotal: ai.total,
        aiFailures: ai.failures,
        errorLogsAvailable: !errorLogsError,
        storageOk: !storageError,
        storageBucketCount: storageError ? null : (storageBuckets?.length ?? 0),
      }),
    };
  });
