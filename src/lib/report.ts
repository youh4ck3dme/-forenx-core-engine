import {
  formatDate,
  formatEur,
  severityLabel,
  type CaseAnalysis,
  type Severity,
} from "@/forensic";
import { RULE_CATALOG, SCORE_METHODOLOGY } from "@/forensic/core/rules";
import { APP_VERSION } from "@/lib/version";
import { listCaseImports, type CaseImportMeta } from "@/lib/case-data";
import { BRAND } from "@/config/brand";

/** Doplnkový kontext reportu: pôvod dát a prípadný text od AI (vždy oddelený). */
export type ReportContext = {
  imports?: CaseImportMeta[];
  ai?: {
    task: string;
    text: string;
    model: string;
    promptVersion: string;
  } | null;
  legalStatus?: string;
};

const severityColor: Record<Severity, string> = {
  critical: "#b3122b",
  high: "#d1442a",
  medium: "#b7791f",
  low: "#2f855a",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

export function buildReportHtml(
  analysis: CaseAnalysis,
  filter: Severity[],
  context: ReportContext = {},
): string {
  const alerts = analysis.alerts.filter(
    (a) => filter.length === 0 || filter.includes(a.severity),
  );
  const generated = new Date().toLocaleString("sk-SK");
  const imports = context.imports ?? [];
  const dates = analysis.case.transactions.map((t) => t.date).sort();
  const range =
    dates.length > 0
      ? `${formatDate(dates[0] as string)} – ${formatDate(dates[dates.length - 1] as string)}`
      : "—";
  const evidenceOf = (alertId: string) => {
    const tx = analysis.case.transactions.filter((t) => alertId.includes(t.id));
    return tx
      .map((t) =>
        t.sourceRow ? `riadok ${t.sourceRow}` : `záznam ${t.id.slice(0, 8)}`,
      )
      .join(", ");
  };

  const rows = alerts
    .map(
      (a) => `<tr>
        <td><strong>${escapeHtml(a.title)}</strong><br /><span class="muted">${escapeHtml(a.detail)}</span></td>
        <td class="nowrap">${escapeHtml(a.source)}<br /><span class="muted">${escapeHtml(evidenceOf(a.id) || "—")}</span></td>
        <td class="nowrap" style="color:${severityColor[a.severity]}"><strong>${severityLabel[a.severity]}</strong></td>
        <td class="num">${a.score}</td>
      </tr>`,
    )
    .join("");

  const entities = analysis.entities
    .map(
      (e) => `<tr>
        <td>${escapeHtml(e.entity.name)}${e.isShell ? ' <span class="tag">schránka</span>' : ""}<br /><span class="muted">${escapeHtml(e.entity.role)}</span></td>
        <td class="nowrap" style="color:${severityColor[e.level]}">${severityLabel[e.level]}</td>
        <td class="num">${e.score}</td>
        <td class="num">${formatEur(e.totalVolume)}</td>
      </tr>`,
    )
    .join("");

  const chains = analysis.chains
    .map((c) => {
      const name = (id: string) =>
        escapeHtml(analysis.case.entities.find((e) => e.id === id)?.name ?? id);
      return `<li><strong>${name(c.shellId)}</strong> — ${c.supplierIds.map(name).join(", ")} → schránka → ${c.buyerIds.map(name).join(", ")}</li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="sk"><head><meta charset="utf-8" />
<title>${BRAND.name} — ${escapeHtml(analysis.case.name)}</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1c1330; font-size: 11px; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 13px; margin: 22px 0 8px; border-bottom: 1px solid #ddd6f3; padding-bottom: 4px; }
  .head { background: linear-gradient(135deg,#3b1470,#6d28d9); color: #fff; padding: 16px 18px; border-radius: 12px; }
  .head p { margin: 2px 0 0; opacity: .85; }
  .grid { display: flex; gap: 10px; margin-top: 12px; }
  .kpi { flex: 1; border: 1px solid #e6e0f5; border-radius: 10px; padding: 8px 10px; }
  .kpi span { display: block; color: #6b6382; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
  .kpi strong { font-size: 15px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #6b6382; border-bottom: 1px solid #ddd6f3; padding: 6px 4px; }
  td { border-bottom: 1px solid #f0ecfa; padding: 6px 4px; vertical-align: top; }
  .muted { color: #6b6382; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .nowrap { white-space: nowrap; }
  .tag { background: #fde7ea; color: #b3122b; border-radius: 8px; padding: 1px 5px; font-size: 9px; }
  footer { margin-top: 20px; font-size: 9px; color: #6b6382; }
  tr { break-inside: avoid; }
</style></head>
<body>
  <div class="head">
    <h1>${escapeHtml(analysis.case.name)}</h1>
    <p>${escapeHtml(analysis.case.subtitle)}</p>
    <p>Celková rizikovosť: <strong>${severityLabel[analysis.caseLevel]} ${analysis.caseScore}/100</strong></p>
  </div>

  <div class="grid">
    <div class="kpi"><span>Subjekty</span><strong>${analysis.totals.entities}</strong></div>
    <div class="kpi"><span>Transakcie</span><strong>${analysis.totals.transactions}</strong></div>
    <div class="kpi"><span>Objem (${escapeHtml(analysis.case.baseCurrency)})</span><strong>${formatEur(analysis.totals.volume)}</strong></div>
    <div class="kpi"><span>Meny</span><strong>${escapeHtml(analysis.totals.currencies.join(", ") || "—")}</strong></div>
    <div class="kpi"><span>Hotovosť</span><strong>${Math.round(analysis.totals.cashRatio * 100)} %</strong></div>
    <div class="kpi"><span>Zhody EUROPOL</span><strong>${analysis.totals.europolMatches}/${analysis.totals.weapons}</strong></div>
  </div>

  <h2>Metodika a obmedzenia</h2>
  <p class="muted">Verzia pravidiel: <strong>${escapeHtml(analysis.rulesVersion)}</strong>. ${escapeHtml(SCORE_METHODOLOGY.summary)}
  Zistenia sú označené ako <em>fakt</em> (priamo pozorované v zadaných dátach) alebo <em>heuristika</em> (interpretácia podľa prahu).
  Skóre nie je dôkazom trestnej činnosti a môže obsahovať falošne pozitívne výsledky. Sumy sa nekonvertujú medzi menami —
  objem sa uvádza v základnej mene prípadu (${escapeHtml(analysis.case.baseCurrency)}).</p>
  <table><thead><tr><th>Pravidlo</th><th>Trieda</th><th>Podmienka</th><th>Základ prahu</th></tr></thead><tbody>
  ${Object.values(RULE_CATALOG)
    .map(
      (rule) =>
        `<tr><td>${escapeHtml(rule.id)}</td><td>${escapeHtml(rule.kind)}</td><td>${escapeHtml(rule.condition)}</td><td class="muted">${escapeHtml(rule.basis)}</td></tr>`,
    )
    .join("")}
  </tbody></table>

  <h2>Zistenia (${alerts.length}${filter.length ? ` — filter: ${filter.map((f) => severityLabel[f]).join(", ")}` : ""})</h2>
  <table><thead><tr><th>Zistenie</th><th>Zdroj</th><th>Závažnosť</th><th class="num">Skóre</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="4" class="muted">Žiadne zistenia pre zvolený filter.</td></tr>'}</tbody></table>

  <h2>Subjekty</h2>
  <table><thead><tr><th>Subjekt</th><th>Závažnosť</th><th class="num">Skóre</th><th class="num">Objem</th></tr></thead>
  <tbody>${entities}</tbody></table>

  <h2>Detegované reťazce</h2>
  <ul>${chains || "<li>Žiadne</li>"}</ul>

  <h2>Pôvod dát</h2>
  <p class="muted">Rozsah dát: <strong>${escapeHtml(range)}</strong> • ${analysis.totals.transactions} transakcií •
  odtlačok dát (revízia): <strong>${escapeHtml(analysis.dataFingerprint ?? "—")}</strong> •
  verzia aplikácie: ${escapeHtml(APP_VERSION)} • verzia pravidiel: ${escapeHtml(analysis.rulesVersion)}.</p>
  ${
    imports.length
      ? `<table><thead><tr><th>Súbor</th><th>Riadky</th><th>Parser / mapovanie</th><th>SHA-256 originálu</th></tr></thead><tbody>${imports
          .map(
            (i) =>
              `<tr><td>${escapeHtml(i.filename)}<br /><span class="muted">${escapeHtml(new Date(i.createdAt).toLocaleString("sk-SK"))}${i.partial ? " • čiastočný import" : ""}</span></td>
              <td class="num">${i.validRows}/${i.totalRows}${i.errorRows ? ` (${i.errorRows} chybných)` : ""}</td>
              <td class="muted">${escapeHtml(i.parserVersion)}<br />${escapeHtml(JSON.stringify(i.columnMapping))}</td>
              <td class="muted" style="word-break:break-all">${escapeHtml(i.sha256)}${i.originalStored ? "" : "<br />originál neuložený"}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : '<p class="muted">Transakcie boli zadané ručne — žiadny importovaný súbor.</p>'
  }
  <p class="muted">Odkazy na zdrojové riadky pri zisteniach: ${
    analysis.case.transactions.some((t) => t.sourceRow)
      ? "uvedené v stĺpci Zdroj (číslo riadka v importovanom súbore)."
      : "nie sú k dispozícii pri ručne zadaných záznamoch."
  }</p>

  <h2>Právne odkazy</h2>
  <p class="muted">${escapeHtml(
    context.legalStatus ??
      "Právne ustanovenia sú uvedené vo verzionovanej podobe v module Právny kontext. Znenie predpisov nie je automaticky overované voči Slov-Lex — pred použitím overte účinnú verziu.",
  )}</p>

  ${
    context.ai
      ? `<h2>Text vygenerovaný AI (neoverený)</h2>
      <p class="muted">Model ${escapeHtml(context.ai.model)}, šablóna ${escapeHtml(context.ai.promptVersion)}, úloha ${escapeHtml(context.ai.task)}.
      Nasledujúci text vytvorila jazyková AI. Nie je to zistenie detektora ani fakt — slúži ako návrh na kontrolu človekom.</p>
      <p>${escapeHtml(context.ai.text).replace(/\n/g, "<br />")}</p>`
      : ""
  }

  <h2>Časová os</h2>
  <table><thead><tr><th>Dátum</th><th>Udalosť</th></tr></thead><tbody>
  ${analysis.case.events
    .map(
      (e) =>
        `<tr><td class="nowrap">${formatDate(e.date)}</td><td><strong>${escapeHtml(e.title)}</strong><br /><span class="muted">${escapeHtml(e.detail)}</span></td></tr>`,
    )
    .join("")}
  </tbody></table>

  <footer>Vygenerované aplikáciou ${BRAND.name} • ${generated} • dokument slúži na interné analytické účely.</footer>
</body></html>`;
}

/** Otvorí systémový dialóg tlače / uloženia do PDF nad vygenerovanou správou. */
export function exportCaseReport(
  analysis: CaseAnalysis,
  filter: Severity[],
  context: ReportContext = {},
): boolean {
  if (typeof document === "undefined") return false;
  const html = buildReportHtml(analysis, filter, context);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const print = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
  if (frame.contentWindow?.document.readyState === "complete") print();
  else frame.onload = print;
  return true;
}

/**
 * Report vrátane metadát importov. Ak sa metadáta nepodarí načítať,
 * report sa aj tak vygeneruje — bez pôvodu dát, s výslovnou poznámkou.
 */
export async function exportCaseReportWithSources(
  analysis: CaseAnalysis,
  filter: Severity[],
  extra: Omit<ReportContext, "imports"> = {},
): Promise<boolean> {
  let imports: CaseImportMeta[] = [];
  try {
    imports = await listCaseImports(analysis.case.id);
  } catch {
    imports = [];
  }
  return exportCaseReport(analysis, filter, { ...extra, imports });
}
