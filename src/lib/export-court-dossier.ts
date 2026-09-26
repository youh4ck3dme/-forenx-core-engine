import type { ForensicCaseUnified } from "@/types/forensic-case";
import type { CopilotAnswer } from "./case-copilot";
import {
  canonicalJson,
  caseSnapshotHash,
  formatCourtSource,
  sha256Bytes,
} from "./court-evidence";
import { createCaseRedactor, redactUnifiedCase } from "./case-privacy";
import { sha256Hex } from "./export-pdf";
import { AI_DISCLAIMER } from "@/config/brand";

export type CourtReportOptions = {
  issuer: string;
  generatedAt?: string;
  summary?: CopilotAnswer;
};

export function buildCourtDossierData(
  snapshot: ForensicCaseUnified,
  options: CourtReportOptions,
) {
  const caseHash = caseSnapshotHash(snapshot);
  if (options.summary && options.summary.snapshotHash !== caseHash)
    throw new Error(
      "Zhrnutie patrí inej verzii prípadu. Vygenerujte ho znova.",
    );
  const redact = createCaseRedactor(snapshot);
  const safe = redactUnifiedCase(snapshot);
  const name = (id: string) =>
    safe.entities.find((item) => item.id === id)?.name ?? "Nepriradený subjekt";
  const summary =
    options.summary?.statements.map((item) => ({
      text: redact(item.text),
      sources: item.sources.map((source) =>
        redact(formatCourtSource(source, snapshot)),
      ),
    })) ?? [];
  const report = {
    version: "forenx-court-dossier/1",
    issuer: options.issuer.trim() || "Spracovateľ neuvedený",
    title: "Forenzná správa",
    caseTitle: safe.metadata.name,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    referenceDate: safe.metadata.referenceDate,
    caseHash,
    privacy:
      "Pseudonymizovaná pracovná kópia; automatická redakcia vyžaduje kontrolu voľného textu.",
    disclaimer: AI_DISCLAIMER,
    isDemo: snapshot.metadata.isDemo,
    summary: { model: options.summary?.model ?? null, statements: summary },
    documents: safe.documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      sha256: doc.sha256,
      hashBasis: doc.hashBasis ?? "legacy_unknown",
      pages: doc.pageCount,
    })),
    entities: safe.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      role: entity.role,
      source: entity.intelligence?.source ?? "Neoverené",
      checkedAt: entity.intelligence?.lastCheckedAt ?? "Neuvedené",
      risk: entity.intelligence?.verified
        ? `${entity.intelligence.riskScore}/100`
        : "Neoverené",
      taxDebtor: entity.intelligence?.verified
        ? entity.intelligence.taxDebtor
          ? "Áno"
          : "Nie podľa záznamu"
        : "Neoverené",
      taxDebts: entity.intelligence?.verified
        ? (entity.intelligence.taxDebts ?? null)
        : null,
      executions: entity.intelligence?.verified
        ? (entity.intelligence.executions ?? null)
        : null,
      bankruptcy: entity.intelligence?.verified
        ? entity.intelligence.inBankruptcy
          ? "Áno"
          : "Nie podľa záznamu"
        : "Neoverené",
    })),
    transactions: safe.transactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      from: name(tx.fromEntityId),
      to: name(tx.toEntityId),
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description,
      anomalies: tx.anomalies,
      source: formatCourtSource(tx.sourceRef, safe),
    })),
    graph: [
      ...safe.relationships.map((edge) => ({
        from: name(edge.fromEntityId),
        to: name(edge.toEntityId),
        label: edge.label || edge.type,
      })),
      ...safe.transactions.map((tx) => ({
        from: name(tx.fromEntityId),
        to: name(tx.toEntityId),
        label: `${tx.id}: ${tx.amount} ${tx.currency} (${tx.date})`,
      })),
    ],
    timeline: [...safe.timeline]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((item) => ({
        date: item.timestamp,
        title: item.title,
        detail: item.detail,
        source: formatCourtSource(item.sourceRef, safe),
      })),
  };
  return { ...report, reportHash: sha256Hex(canonicalJson(report)) };
}

export type CourtDossierData = ReturnType<typeof buildCourtDossierData>;

/** Vector text and diagrams, with embedded Slovak glyphs and repeating table headers. */
export async function renderCourtDossierPdf(
  report: CourtDossierData,
  fontBase64: string,
): Promise<Uint8Array> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  pdf.addFileToVFS("NotoSans.ttf", fontBase64);
  pdf.addFont("NotoSans.ttf", "NotoSans", "normal");
  pdf.setFont("NotoSans");
  pdf.setProperties({
    title: "ForenX - Forenzná správa",
    author: report.issuer,
    subject: "Pseudonymizovaná pracovná analýza",
  });
  let y = 24;
  const text = (value: string, size = 10) => {
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(value || "—", 174) as string[];
    for (const line of lines) {
      if (y > 270) {
        pdf.addPage();
        y = 24;
      }
      pdf.text(line, 18, y);
      y += size * 0.48;
    }
    y += 3;
  };
  const section = (title: string) => {
    pdf.addPage();
    y = 25;
    text(title, 16);
    y += 5;
  };
  const table = (head: string[], body: string[][]) => {
    autoTable(pdf, {
      startY: y,
      margin: { left: 18, right: 18, top: 23, bottom: 22 },
      head: [head],
      body: body.length
        ? body
        : [head.map((_, i) => (i ? "—" : "Údaje nie sú dostupné"))],
      styles: {
        font: "NotoSans",
        fontStyle: "normal",
        fontSize: 8,
        cellPadding: 2.5,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [25, 47, 71],
        textColor: 255,
        fontStyle: "normal",
      },
      alternateRowStyles: { fillColor: [244, 247, 250] },
      rowPageBreak: "avoid",
    });
    y =
      (pdf as typeof pdf & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
  };
  pdf.setFillColor(25, 47, 71);
  pdf.rect(0, 0, 210, 10, "F");
  text("FORENX / ANALÝZA SPISU", 11);
  y += 10;
  text(report.title, 27);
  text(report.issuer, 14);
  text(report.caseTitle, 14);
  y += 8;
  text(`Dátum analýzy: ${report.generatedAt}`);
  text(`Referenčný dátum: ${report.referenceDate}`);
  text(`SHA-256 snímky spisu: ${report.caseHash}`, 9);
  text(`SHA-256 dát správy: ${report.reportHash}`, 9);
  text(
    "Odtlačky sa vzťahujú na kanonické dáta uvedené v manifeste. Nejde o elektronický podpis ani časovú pečiatku. Odtlačok PDF sa počíta až po jeho vytvorení a je uvedený v sprievodnom manifeste.",
    9,
  );
  text(report.privacy, 9);
  text(report.disclaimer, 9);
  if (report.isDemo) text("SYNTETICKÁ UKÁŽKA - fiktívne údaje", 13);
  text("Zoznam zdrojových súborov a ich zaznamenaných odtlačkov", 12);
  table(
    ["Súbor / strany", "SHA-256", "Rozsah odtlačku"],
    report.documents.map((doc) => [
      `${doc.name}\n${doc.pages || "?"} strán`,
      doc.sha256,
      doc.hashBasis === "file_bytes"
        ? "Pôvodné bajty pri importe"
        : doc.hashBasis === "extracted_text"
          ? "Iba dodaný text"
          : "Starší odtlačok; pôvod neoverený",
    ]),
  );
  section("I. Exekutívne zhrnutie kauzy");
  text(`Model: ${report.summary.model ?? "AI zhrnutie nebolo vytvorené"}`, 9);
  if (!report.summary.statements.length)
    text(
      "Nie je dostupné zhrnutie s presnými odkazmi na listinné dôkazy. Skutkové závery sa nedopĺňajú odhadom.",
    );
  for (const item of report.summary.statements) {
    text(item.text);
    text(item.sources.join("\n"), 8);
  }
  section("II. Identifikované subjekty a previerka");
  text(
    "Rizikové skóre je údaj previerky, nie dôkaz viny. Neznáme údaje sa neoznačujú ako nulové dlhy či neprítomnosť exekúcií.",
    9,
  );
  table(
    [
      "Subjekt / rola",
      "Zdroj / dátum",
      "Riziko",
      "Daňové dlhy",
      "Exekúcie / konkurz",
    ],
    report.entities.map((entity) => [
      `${entity.name}\n${entity.role}`,
      `${entity.source}\n${entity.checkedAt}`,
      entity.risk,
      `${entity.taxDebtor}\n${entity.taxDebts === null ? "Zoznam nedostupný" : entity.taxDebts.map((debt) => `${debt.authority}: ${debt.amount} ${debt.currency}`).join("\n") || "Prázdny zoznam"}`,
      `${entity.executions === null ? "Exekúcie: neoverené" : entity.executions.map((execution) => `${execution.reference}: ${execution.status}`).join("\n") || "Prázdny zoznam exekúcií"}\nKonkurz: ${entity.bankruptcy}`,
    ]),
  );
  section("III. Rekonštrukcia finančných tokov");
  text(
    "Uvedené anomálie sú signály na preverenie. Správa nevyvodzuje nezákonnosť transakcie zo samotnej anomálie.",
    9,
  );
  table(
    ["Dátum / ID", "Tok / popis", "Suma", "Anomálie", "Dôkaz"],
    report.transactions.map((tx) => [
      `${tx.date}\n${tx.id}`,
      `${tx.from} → ${tx.to}\n${tx.description}`,
      `${tx.amount.toLocaleString("sk-SK")} ${tx.currency}`,
      tx.anomalies.join("\n") || "—",
      tx.source,
    ]),
  );
  section("IV. Graf väzieb a finančných tokov");
  text(
    "Smer šípky zodpovedá smeru väzby alebo platby. Diagram je rozdelený do čitateľných väzieb; opakované označenie predstavuje rovnaký subjekt.",
    9,
  );
  if (!report.graph.length)
    text("V spise nie sú dostupné väzby ani transakcie.");
  for (const edge of report.graph) {
    const left = pdf.splitTextToSize(edge.from, 44) as string[];
    const right = pdf.splitTextToSize(edge.to, 44) as string[];
    const label = pdf.splitTextToSize(edge.label, 64) as string[];
    const height = Math.max(
      22,
      Math.max(left.length, right.length, label.length) * 4 + 12,
    );
    if (height > 235)
      throw new Error(
        "Popis väzby je príliš dlhý pre diagram. Skráťte ho v zdrojových dátach.",
      );
    if (y + height > 270) {
      pdf.addPage();
      y = 24;
    }
    pdf.setFontSize(8);
    pdf.setDrawColor(90, 115, 140);
    pdf.setFillColor(242, 246, 250);
    pdf.roundedRect(18, y, 50, height, 3, 3, "FD");
    pdf.roundedRect(142, y, 50, height, 3, 3, "FD");
    pdf.text(left, 21, y + 7);
    pdf.text(right, 145, y + 7);
    const lineY = y + height - 5;
    pdf.line(68, lineY, 142, lineY);
    pdf.line(138, lineY - 2, 142, lineY);
    pdf.line(138, lineY + 2, 142, lineY);
    pdf.text(label, 73, y + 6);
    y += height + 9;
  }
  section("V. Časová rekonštrukcia skutkového deja");
  table(
    ["Čas", "Udalosť", "Listinný dôkaz"],
    report.timeline.map((item) => [
      item.date,
      `${item.title}\n${item.detail}`,
      item.source,
    ]),
  );
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(80);
    pdf.text(`ForenX / Pseudonymizovaná pracovná analýza`, 18, 286);
    pdf.text(`${page} / ${pages}`, 190, 286, { align: "right" });
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}

export async function exportCourtDossier(
  snapshot: ForensicCaseUnified,
  options: CourtReportOptions,
) {
  const report = buildCourtDossierData(snapshot, options);
  const response = await fetch("/fonts/NotoSans-Regular.ttf");
  if (!response.ok)
    throw new Error("Písmo pre slovenský PDF export sa nepodarilo načítať.");
  const font = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (const byte of font) binary += String.fromCharCode(byte);
  const bytes = await renderCourtDossierPdf(report, btoa(binary));
  const pdfSha256 = await sha256Bytes(bytes);
  const filename = `forenx-sprava-${report.reportHash.slice(0, 12)}.pdf`;
  return { bytes, filename, manifest: { report, pdfSha256, filename } };
}

export function downloadCourtFile(
  bytes: Uint8Array | string,
  filename: string,
  type: string,
) {
  const blob = new Blob(
    [typeof bytes === "string" ? bytes : new Uint8Array(bytes)],
    { type },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
