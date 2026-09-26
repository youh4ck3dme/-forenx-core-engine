import type { ForensicDossier } from "./types";
import { formatSourceRef } from "./types";
import { AI_DISCLAIMER } from "@/config/brand";

// ─── Kryptografický výpočet SHA-256 (NIST FIPS 180-4) ────────────

/**
 * Deterministický výpočet SHA-256 podľa štandardu FIPS 180-4.
 * Funguje 100 % synchrónne v Node.js aj v prehliadači bez externých závislostí.
 */
export function sha256Hex(str: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const bytes = new TextEncoder().encode(str);
  const bitLength = bytes.length * 8;
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >> 2] = (words[i >> 2] ?? 0) | (bytes[i]! << ((3 - (i % 4)) * 8));
  }
  words[bytes.length >> 2] =
    (words[bytes.length >> 2] ?? 0) | (0x80 << ((3 - (bytes.length % 4)) * 8));
  const totalWords = (((bytes.length + 8) >> 6) + 1) * 16;
  while (words.length < totalWords) words.push(0);
  words[totalWords - 2] = Math.floor(bitLength / maxWord);
  words[totalWords - 1] = bitLength >>> 0;

  const k: number[] = [];
  let hash: number[] = [];
  let primeCounter = 0;
  for (let candidate = 2; primeCounter < 64; candidate++) {
    let isComp = false;
    for (let i = 2; i * i <= candidate; i++) {
      if (candidate % i === 0) {
        isComp = true;
        break;
      }
    }
    if (!isComp) {
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8);

  for (let j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = [...hash];
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15]!,
        w2 = w[i - 2]!;
      const a = hash[0]!,
        e = hash[4]!;
      const temp1 =
        hash[7]! +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]!) ^ (~e & hash[6]!)) +
        k[i]! +
        (w[i] =
          i < 16
            ? w[i]! | 0
            : (w[i - 16]! +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7]! +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]!) ^ (a & hash[2]!) ^ (hash[1]! & hash[2]!));
      hash = [
        (temp1 + temp2) | 0,
        hash[0]!,
        hash[1]!,
        hash[2]!,
        (hash[3]! + temp1) | 0,
        hash[4]!,
        hash[5]!,
        hash[6]!,
      ];
    }
    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i]! + oldHash[i]!) | 0;
    }
  }

  let result = "";
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i]! >>> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

/**
 * Vypočíta kanonický kryptografický odtlačok (SHA-256) forenzného dossieru.
 * Zabezpečuje dôkaznú nemennosť a overiteľnosť elektronického spisu podľa § 119 TP.
 */
export function computeDossierSha256(dossier: ForensicDossier): string {
  // Sort every object, retaining nested evidence and metadata; preserve array order.
  const canonical = JSON.stringify(dossier, (_key, value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    }
    return value;
  });
  return sha256Hex(canonical);
}

/**
 * Vypočíta SHA-256 hash z vygenerovaného HTML textu posudku.
 */
export function computeReportSha256(html: string): string {
  return sha256Hex(html);
}

// ─── Export § 168 TP reportu do tlačiteľnej HTML → PDF ───────────

export function exportDossierToPDF(dossier: ForensicDossier): void {
  const html = buildReportHTML(dossier);

  const win = window.open("", "_blank");
  if (!win) {
    alert("Povoľte vyskakovacie okná pre export reportu.");
    return;
  }

  win.document.write(html);
  win.document.close();

  setTimeout(() => {
    win.focus();
    win.print();
  }, 500);
}

export function buildReportHTML(d: ForensicDossier): string {
  const dossierHash = computeDossierSha256(d);

  const timelineHtml =
    d.facts.timeline.length > 0
      ? `
  <h2>Chronológia skutkov (zdrojované udalosti)</h2>
  <table>
    <thead>
      <tr>
        <th style="width:14%">Čas</th>
        <th style="width:46%">Udalosť</th>
        <th style="width:40%">Zdroj (dokument · strana · výňatok)</th>
      </tr>
    </thead>
    <tbody>
      ${d.facts.timeline
        .map((ev) => {
          const src = formatSourceRef(ev.sourceRef) || ev.source?.trim() || "—";
          return `
        <tr>
          <td>${ev.time}</td>
          <td>${ev.event}</td>
          <td><code>${src}</code></td>
        </tr>`;
        })
        .join("")}
    </tbody>
  </table>`
      : "";

  const tracesRows = d.evidenceStrength.traces
    .map((t) => {
      const src = formatSourceRef(t.sourceRef) || "—";
      return `
    <tr>
      <td><code>${t.id}</code></td>
      <td><strong>${t.name}</strong></td>
      <td style="text-align:center;font-weight:bold">${t.lr}</td>
      <td style="text-align:center">${strengthEmoji(t.light)}</td>
      <td>${t.strength}</td>
      <td>${t.paragraph}</td>
      <td><code>${src}</code></td>
    </tr>`;
    })
    .join("");

  const attacksHtml = d.defenseAttack.attacks
    .map((a) => {
      const src = formatSourceRef(a.sourceRef);
      return `
    <div class="attack">
      <p class="attack-claim"><strong>Tvrdenie obhajoby:</strong> ${a.defenseClaim}</p>
      <p class="attack-counter"><strong>Protiúder zo spisu:</strong> ${a.counterStrike}</p>
      <p class="attack-gap"><em>Identifikovaná medzera:</em> ${a.evidenceGap} — <strong class="badge-risk">Riziko: ${a.risk}</strong></p>
      ${src ? `<p class="attack-src" style="font-size:9pt;color:#475569"><strong>Zdroj:</strong> <code>${src}</code></p>` : ""}
    </div>`;
    })
    .join("");

  const questionsHtml = d.investigativeAnswers
    ? `
  <h2>Záväzný analytický rámec ÚBOK (3 vyšetrovacie otázky — Source of Truth)</h2>
  <div class="section">
    <div class="question-card">
      <h3>1. ${d.investigativeAnswers.q1_buyer_seller.question}</h3>
      <p>${d.investigativeAnswers.q1_buyer_seller.answer}</p>
      <p class="question-meta"><strong>Identifikované osoby:</strong> ${d.investigativeAnswers.q1_buyer_seller.identifiedPersons.join(", ")} · <strong>Miera istoty:</strong> ${d.investigativeAnswers.q1_buyer_seller.confidenceLevel} %</p>
    </div>
    <div class="question-card">
      <h3>2. ${d.investigativeAnswers.q2_planner_coordinator.question}</h3>
      <p>${d.investigativeAnswers.q2_planner_coordinator.answer}</p>
      <p class="question-meta"><strong>Identifikované osoby:</strong> ${d.investigativeAnswers.q2_planner_coordinator.identifiedPersons.join(", ")} · <strong>Miera istoty:</strong> ${d.investigativeAnswers.q2_planner_coordinator.confidenceLevel} %</p>
    </div>
    <div class="question-card">
      <h3>3. ${d.investigativeAnswers.q3_financier.question}</h3>
      <p>${d.investigativeAnswers.q3_financier.answer}</p>
      <p class="question-meta"><strong>Identifikované osoby:</strong> ${d.investigativeAnswers.q3_financier.identifiedPersons.join(", ")} · <strong>Miera istoty:</strong> ${d.investigativeAnswers.q3_financier.confidenceLevel} %</p>
    </div>
  </div>`
    : "";

  const contradictionsHtml =
    d.testimonyContradictions && d.testimonyContradictions.length > 0
      ? `
  <h2>Rozpory vo výpovediach & Matica pravdovravnosti (§ 125 TP — Konfrontácia)</h2>
  <p class="legal-expl">
    V zmysle <strong>§ 125 Trestného poriadku</strong>, ak sa výpovede obvinených alebo svedkov v závažných okolnostiach nezhodujú, vykoná sa konfrontácia alebo opakovaný výsluch. Nasledujúca matica zachytáva identifikované skutkové protirečenia, kvantifikovanú mieru nepravdy a navrhovaný procesný postup OČTK:
  </p>
  <table>
    <thead>
      <tr>
        <th style="width:17%">Téma rozporu</th>
        <th style="width:28%">Výpoveď v konaní</th>
        <th style="width:27%">Objektívny skutkový stav zo spisu</th>
        <th style="width:10%;text-align:center">Miera nepravdy</th>
        <th style="width:18%">Procesný postup (§ 125 TP)</th>
      </tr>
    </thead>
    <tbody>
      ${d.testimonyContradictions
        .map(
          (tc) => `
        <tr>
          <td><strong>${tc.topic}</strong></td>
          <td><em>${tc.personA.name} (${tc.personA.status}):</em> „${tc.personA.claim}“</td>
          <td>${tc.factualRecord}</td>
          <td style="text-align:center;font-weight:bold;color:${tc.deceitPercentage >= 75 ? "#dc2626" : "#d97706"}">${tc.deceitPercentage} %</td>
          <td>${tc.proceduralResolution}</td>
        </tr>`,
        )
        .join("")}
    </tbody>
  </table>`
      : "";

  const financialHtml = d.financialAnalysis
    ? `
  <h2>Forenzná analýza transakcií a tokov financií (§ 119 ods. 1 písm. f) TP)</h2>
  <div class="section">
    <p><strong>Celkový objem:</strong> ${d.financialAnalysis.totalVolume.toLocaleString("sk-SK")} € · <strong>Hotovosť:</strong> ${d.financialAnalysis.cashVolume.toLocaleString("sk-SK")} € (${d.financialAnalysis.cashRatioPercent} %) · <strong>Prevody:</strong> ${d.financialAnalysis.transferVolume.toLocaleString("sk-SK")} €</p>
    <p><em>Záver o financovaní:</em> ${d.financialAnalysis.financingConclusion}</p>
    <h3>Podozrivé finančné toky a platobné operácie</h3>
    <table>
      <thead>
        <tr>
          <th style="width:12%">Dátum</th>
          <th style="width:28%">Platiteľ ➔ Príjemca</th>
          <th style="width:15%;text-align:right">Suma</th>
          <th style="width:15%;text-align:center">Forma platby</th>
          <th style="width:30%">Účel platby & Forenzný indikátor (Red Flag)</th>
        </tr>
      </thead>
      <tbody>
        ${d.financialAnalysis.suspiciousFlows
          .map(
            (sf) => `
          <tr>
            <td>${sf.date}</td>
            <td>${sf.payer} ➔ ${sf.recipient}</td>
            <td style="text-align:right;font-weight:bold">${sf.amount.toLocaleString("sk-SK")} €</td>
            <td style="text-align:center">${sf.method}</td>
            <td><strong>${sf.purpose}</strong>: ${sf.redFlag}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="UTF-8">
<title>AI pracovná analýza — ${d.caseTitle}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.5; color: #111827; margin: 0; padding: 20px; }
  .court-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
  .court-agency { font-size: 10pt; font-weight: bold; letter-spacing: 1px; color: #475569; text-transform: uppercase; margin-bottom: 4px; }
  h1 { font-size: 16pt; margin: 6px 0; color: #0f172a; text-transform: uppercase; }
  h2 { font-size: 12.5pt; margin-top: 22px; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #0f172a; }
  h3 { font-size: 10.5pt; margin-top: 14px; margin-bottom: 6px; color: #334155; }
  .meta { text-align: center; font-size: 9.5pt; color: #475569; margin-bottom: 18px; line-height: 1.6; }
  .meta-hash code { font-family: "Courier New", monospace; font-size: 8.5pt; background: #f1f5f9; padding: 2px 6px; border: 1px solid #cbd5e1; border-radius: 3px; }
  .index-box { background: #f8fafc; border: 1.5px solid #3b82f6; border-radius: 4px; padding: 12px; margin: 16px 0; text-align: center; }
  .index-box p { margin: 2px 0; font-size: 10pt; }
  .index-box .num { font-size: 26pt; font-weight: bold; color: ${d.defendabilityIndex >= 75 ? "#16a34a" : d.defendabilityIndex >= 50 ? "#d97706" : "#dc2626"}; }
  .legal-expl { font-size: 9.5pt; color: #475569; font-style: italic; margin: 4px 0 10px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9.5pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
  th, td { border: 1px solid #94a3b8; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: bold; color: #0f172a; }
  .question-card { background: #f8fafc; border-left: 4px solid #2563eb; padding: 8px 12px; margin: 8px 0; }
  .question-card h3 { margin: 2px 0 4px 0; font-size: 10.5pt; color: #1e3a8a; }
  .question-card p { margin: 4px 0; font-size: 10pt; }
  .question-meta { font-size: 9pt; color: #64748b; margin-top: 4px !important; }
  .attack { border-left: 3px solid #dc2626; padding: 8px 12px; margin: 8px 0; background: #fff5f5; page-break-inside: avoid; }
  .attack-claim { color: #991b1b; margin: 2px 0; font-size: 10pt; }
  .attack-counter { color: #166534; margin: 2px 0; font-size: 10pt; }
  .attack-gap { font-size: 9pt; color: #64748b; margin: 4px 0 0 0; }
  .badge-risk { color: #b91c1c; }
  .section { margin: 14px 0; }
  .integrity-section { margin-top: 30px; border: 1.5px solid #0f172a; background: #fbfcfe; padding: 14px 18px; border-radius: 4px; page-break-inside: avoid; }
  .integrity-section h2 { border-bottom: none; margin-top: 0; padding-bottom: 0; font-size: 12pt; text-transform: uppercase; color: #0f172a; }
  .hash-box { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 3px; margin: 8px 0; }
  .hash-code { font-family: "Courier New", monospace; font-size: 9pt; font-weight: bold; color: #0f172a; word-break: break-all; }
  .legal-clause { font-size: 9pt; line-height: 1.5; color: #334155; margin: 8px 0 14px 0; text-align: justify; }
  .signature-grid { display: flex; justify-content: space-between; margin-top: 35px; }
  .sig-block { width: 45%; text-align: center; }
  .sig-line { border-bottom: 1px solid #475569; margin-bottom: 6px; height: 35px; }
  .sig-block p { margin: 0; font-size: 8.5pt; color: #64748b; text-transform: uppercase; }
  .footer { margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 8.5pt; color: #64748b; text-align: center; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
    .index-box, .question-card, .attack, .integrity-section { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="court-header">
  <div class="court-agency">Prezídium Policajného zboru · Úrad boja proti organizovanej kriminalite</div>
  <h1>FORENZNÝ REPORT — ${d.caseTitle}</h1>
  <div class="meta">
    Spisová značka / ČVS: <strong>${d.caseId}</strong> · Dátum analýzy: <strong>${new Date(d.analysisMeta?.createdAt ?? d.generatedAt).toLocaleString("sk-SK")}</strong><br>
    Procesný formát: <strong>§ 142–147 TP (Odborné vyjadrenie) & § 168 TP (Odôvodnenie — AI pracovný návrh)</strong><br>
    ${
      d.analysisMeta
        ? `Model: <strong>${d.analysisMeta.model}</strong> · Prompt: <strong>${d.analysisMeta.promptVersion}</strong> · Stav: <strong>${d.analysisMeta.analysisStatus}</strong><br>
    Dokumenty: <strong>${(d.analysisMeta.documentIds ?? []).join(", ") || "—"}</strong><br>
    ${
      d.analysisMeta.truncation.truncated
        ? `Upozornenie na skrátenie: analyzovaných ${d.analysisMeta.truncation.analyzedChars} z ${d.analysisMeta.truncation.inputChars} znakov (${d.analysisMeta.truncation.chunkCount} častí).<br>`
        : ""
    }`
        : ""
    }
    <span class="meta-hash">Kryptografický odtlačok spisu (SHA-256): <code>${dossierHash}</code></span>
  </div>
</div>

<div class="ai-disclaimer" style="margin:10px 0;padding:8px 10px;border:1px solid #b45309;background:#fef3c7;color:#7c2d12;font-size:9pt;font-weight:600;">
  ${AI_DISCLAIMER}
  ${d.analysisMeta?.isDemo ? " Toto je SYNTETICKÁ UKÁŽKA — fiktívne údaje." : ""}
</div>

${
  (d.analysisMeta?.sourceReferences?.length ?? 0) > 0
    ? `<div class="section" style="font-size:9pt;color:#475569;margin:8px 0;">
  <strong>Zdroje uvedené v analýze</strong>
  <span style="font-weight:400"> (dokument · strana · úryvok, ak je k dispozícii):</span>
  <ul>${d
    .analysisMeta!.sourceReferences.slice(0, 40)
    .map((s) => `<li>${s}</li>`)
    .join("")}</ul>
</div>`
    : ""
}


<div class="index-box">
  <p><strong>Index obhájiteľnosti obžaloby pred súdom</strong></p>
  <span class="num">${d.defendabilityIndex}/100</span>
  <p style="font-size:9pt;color:#64748b">Kvantitatívny indikátor nepriestrelnosti dôkazov pred súdom Slovenskej republiky</p>
</div>

${questionsHtml}

${timelineHtml}

${contradictionsHtml}

${financialHtml}

<h2>I. Zistený skutkový stav (§ 119 ods. 1 Trestného poriadku)</h2>
<div class="section">
  <p>${d.judgeReadyText.skutkovyStav}</p>
</div>

<h2>II. Vyporiadanie sa s obhajobou obvineného (§ 168 TP)</h2>
<div class="section">
  <p>${d.judgeReadyText.vyporiadanie}</p>
  <h3>Identifikované body útoku obhajoby a dôkazné protiúdery:</h3>
  ${attacksHtml}
</div>

<h2>III. Vedecké zhodnotenie stôp</h2>
<div class="section">
  <p>${d.judgeReadyText.vedecke}</p>
  <h3>Dôkazová matica stôp (§ 119 ods. 2 TP & ENFSI metodika)</h3>
  <table>
    <thead>
      <tr>
        <th style="width:10%">Ev. č.</th>
        <th style="width:22%">Dôkazný prostriedok / Stopa</th>
        <th style="width:12%;text-align:center">LR</th>
        <th style="width:10%;text-align:center">Reťazec</th>
        <th style="width:12%">Sila</th>
        <th style="width:12%">Ustanovenie</th>
        <th style="width:22%">Zdroj</th>
      </tr>
    </thead>
    <tbody>${tracesRows}</tbody>
  </table>
</div>

<h2>IV. Právna kvalifikácia a stav zákonných znakov (§ 294 TZ, § 138 TZ)</h2>
<table>
  <thead>
    <tr>
      <th style="width:14%">Zákonné ust.</th>
      <th style="width:28%">Názov skutkovej podstaty</th>
      <th style="width:14%;text-align:center">Stav naplnenia</th>
      <th style="width:44%">Dôkazné vyhodnotenie a skutkový základ</th>
    </tr>
  </thead>
  <tbody>
    ${d.evidenceStrength.paragraphs
      .map(
        (p) => `
      <tr>
        <td><strong>${p.para}</strong></td>
        <td>${p.title}</td>
        <td style="text-align:center;font-weight:bold;color:${p.status === "OK" ? "#16a34a" : p.status === "Narušené" ? "#dc2626" : "#d97706"}">${p.status}</td>
        <td>${p.note}</td>
      </tr>`,
      )
      .join("")}
  </tbody>
</table>

<div class="integrity-section">
  <h2>V. Doložka integrity a nemennosti elektronického spisu (§ 119 ods. 2 TP)</h2>
  <div class="hash-box">
    <div style="font-size:9pt;color:#475569;margin-bottom:2px">Kryptografický kontrolný odtlačok spisu (FIPS 180-4 SHA-256):</div>
    <div class="hash-code">${dossierHash}</div>
  </div>
  <p class="legal-clause">
    <strong>Doložka AI pôvodu:</strong> Tento dokument je AI pracovná analýza spisu ČVS: <strong>${d.caseId}</strong>, nie znalecký posudok ani rozhodnutie súdu.
    SHA-256 odtlačok viaže aktuálny text reportu; každý dátum, suma, osoba a citácia musia byť overené voči originálu spisu pred použitím v konaní (§ 119 TP).
    ${d.analysisMeta ? `Prompt ${d.analysisMeta.promptVersion}, model ${d.analysisMeta.model}.` : ""}
  </p>
  <div class="signature-grid">
    <div class="sig-block">
      <div class="sig-line"></div>
      <p>Forenzný analytik / OČTK ÚBOK PZ</p>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <p>Dozorujúci prokurátor / Predseda senátu</p>
    </div>
  </div>
</div>

<div class="footer">
  Forenzný Autopilot v1.0 · Vygenerované v súlade s § 142–147 a § 168 Trestného poriadku Slovenskej republiky.
</div>

<div class="no-print" style="text-align:center;margin-top:24px">
  <button onclick="window.print()" style="padding:10px 28px;font-size:12pt;font-weight:bold;background:#1e40af;color:#fff;border:none;border-radius:6px;cursor:pointer">Tlačiť / Uložiť AI pracovnú analýzu ako PDF</button>
</div>

</body>
</html>`;
}

function strengthEmoji(light: string): string {
  if (light === "green") return "🟢";
  if (light === "yellow") return "🟡";
  if (light === "red") return "🔴";
  return "⚪";
}
