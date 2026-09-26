import { onCLS, onINP, onLCP, type Metric } from "web-vitals";

const BUDGETS = {
  LCP: 2500,
  INP: 200,
  CLS: 0.1,
} as const;

function overBudget(metric: Metric): boolean {
  if (metric.name === "LCP") return metric.value > BUDGETS.LCP;
  if (metric.name === "INP") return metric.value > BUDGETS.INP;
  if (metric.name === "CLS") return metric.value > BUDGETS.CLS;
  return false;
}

function reportOverBudget(metric: Metric): void {
  if (!overBudget(metric)) return;
  const route =
    typeof window === "undefined" ? "" : window.location.pathname.slice(0, 500);
  const value =
    metric.name === "CLS"
      ? metric.value.toFixed(3)
      : Math.round(metric.value).toString();

  void import("@/lib/error-log.functions")
    .then(({ reportClientError }) =>
      reportClientError({
        data: {
          message: `web-vital over budget: ${metric.name}=${value}`,
          route,
          severity: "info" as const,
        },
      }),
    )
    .catch(() => undefined);
}

/** Jednorazová registrácia Web Vitals (LCP / INP / CLS). */
export function initWebVitals(): void {
  if (typeof window === "undefined") return;
  onLCP(reportOverBudget);
  onINP(reportOverBudget);
  onCLS(reportOverBudget);
}
