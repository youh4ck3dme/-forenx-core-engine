import type { ForensicDossier } from "@/lib/types";
import { ARMIVEX_CROSS_CONTRADICTIONS } from "@/lib/cross-contradictions";

export const ARMIVEX_CASE_DOSSIER: ForensicDossier = {
  caseId: "PPZ-51/UBOK-PZ-ST-2025",
  caseTitle: "Kauza Armivex & VELTRA — Nedovolené ozbrojovanie (§ 294 TZ)",
  defendabilityIndex: 74,
  generatedAt: new Date().toISOString(),
  facts: {
    timeline: [
      {
        time: "2024-05-21 10:00",
        event:
          "Odkúpenie VELTRA s.r.o.; kúpu sprostredkoval D. Koval, spoločníkom Tavira s.r.o.",
        source: "ORSR, Dôkaz 06",
        chainBreak: false,
      },
      {
        time: "2024-12-27 11:30",
        event:
          "Vydanie zbrojnej licencie LA 002318; trezory z predajne hneď demontované",
        source: "Úradný záznam KR PZ Žilina",
        chainBreak: true,
        severity: "warning",
        paragraph: "§ 98 TP",
      },
      {
        time: "2025-01-23 14:15",
        event:
          "1. nákup v ARMIVEX s.r.o. — 242 zbraní celkovo; osobný odber spochybnený obhajobou (chýba písmoznalectvo)",
        source: "Dôkaz 09 (Výsluch M. Hruška vs. Výsluch E. Novák)",
        chainBreak: true,
        severity: "warning",
        paragraph: "§ 125 TP a § 142 TP",
      },
      {
        time: "2025-09-15 22:40",
        event:
          "Nočné odovzdávanie zbraní na odpočívadlách D1 Trenčín z kufra BMW 7",
        source: "Dôkaz 08, 10 (Malina)",
        chainBreak: true,
        severity: "critical",
        paragraph: "§ 98 TP",
      },
      {
        time: "2026-02-06 08:30",
        event:
          "Europol Španielsko: zaistenie Glock 19 (CGDV051) a GP K100 (K055902, K055904) v gangu",
        source: "Dožiadanie Europol č. ES-441/2026",
        chainBreak: false,
      },
      {
        time: "2026-08-12 15:02",
        event: "Zadržanie E. Nováka a D. Kovala; výsluchy a domové prehliadky",
        source: "Zápisnica o zadržaní PPZ ÚBOK",
        chainBreak: false,
      },
    ],
    traces: [
      {
        id: "TR-01",
        type: "balistická",
        description:
          "Glock 19 Gen 5 (CGDV051) — zaistený v Španielsku, zhoda s predajom v Armivexe",
        light: "green",
        chainComplete: true,
        lr: "> 1 000 000",
        paragraph: "§ 119 ods. 2 TP",
      },
      {
        id: "TR-02",
        type: "balistická",
        description:
          "Grand Power K100 (K055902, K055904) — dodávka VELTRA z Armivexu",
        light: "green",
        chainComplete: true,
        lr: "1 : 25 000",
        paragraph: "§ 119 ods. 2 TP",
      },
      {
        id: "TR-03",
        type: "dokument",
        description:
          "Kniha evidencie zbraní a streliva LA 002318 — úmyselne stratená/nedodaná",
        light: "red",
        chainComplete: false,
        lr: "—",
        paragraph: "§ 98 TP",
      },
      {
        id: "TR-04",
        type: "dokument",
        description:
          "Výpisy Dunajská banka — úhrady zálohových faktúr Armivex s.r.o. z hotovostných vkladov",
        light: "green",
        chainComplete: true,
        lr: "—",
        paragraph: "§ 116 TP",
      },
      {
        id: "TR-05",
        type: "digitálna",
        description:
          "Zvukové nahrávky od D. Malinu v BMW X6 — dokumentujú marže 10-20 €/ks",
        light: "yellow",
        chainComplete: false,
        lr: "—",
        paragraph: "§ 115 TP",
      },
    ],
  },
  defenseAttack: {
    overallRisk: "VYSOKÉ",
    attacks: [
      {
        id: "DA-1",
        defenseClaim:
          "Koval: 'Bol som len najatý šofér za 300 € na cestu, v taškách som zbrane nevidel a netušil som, že ide o nelegálny tovar.'",
        risk: "VYSOKÉ",
        counterStrike:
          "Vozidlo BMW malo pečiatky firiem VELTRA aj Bark Factory, Koval mal rukou písané zoznamy kalibrov a zabezpečoval plnomocenstvá. Navrhnúť znalecké posúdenie písma a výsluch advokátov k plnomocenstvám.",
        evidenceGap:
          "Chýba grafologická expertíza rukou písaných zoznamov modelov v aute.",
        paragraph: "§ 142 TP",
      },
      {
        id: "DA-2",
        defenseClaim:
          "Novák: 'V Armivexe som v živote nebol, zbrane som neprevzal a Mareka Hrušku nepoznám. Moja rola bola len kliknúť platbu.'",
        risk: "KRITICKÉ",
        counterStrike:
          "Tvrdenie svedka Mareka Hrušku o osobnom odbere v Žiline je sporné a v procesnom rozpore (§ 125 TP). V predajni chýbajú kamerové záznamy a BTS lokalizácia mobilu Nováka nesedí so Žilinou. Vykonať konfrontáciu podľa § 125 TP a nariadiť písmoznalecký posudok podpisov v knihe zbraní podľa § 142 TP.",
        evidenceGap:
          "Protokoly o prevzatí zbraní z predajne v Žiline a knihy zbraní neboli podrobené porovnaniu podpisového vzoru (§ 142 TP).",
        paragraph: "§ 125 TP a § 142 TP",
      },
      {
        id: "DA-3",
        defenseClaim:
          "Nahrávky predložené D. Malinaom sú nelegálny odposluch z pomsty za odcudzené vozidlá BMW X6 a X5.",
        risk: "STREDNÉ",
        counterStrike:
          "Nahrávka súkromnej osoby nie je odposluchom podľa § 115 TP a je procesne použiteľná, ak zachytáva páchanie závažného zločinu. Podporiť lokalizačnými dátami BTS z odpočívadla D1 Livinské Opatovce.",
        evidenceGap:
          "Chýba verifikácia metadát a zariadenia, na ktoré bola nahrávka zaznamenaná.",
        paragraph: "§ 115 TP a § 119 TP",
      },
    ],
  },
  evidenceStrength: {
    traces: [
      {
        id: "TR-01",
        name: "Glock 19 Gen 5 (CGDV051) — Europol",
        lr: "> 1 000 000",
        strength: "Nepriestrelné",
        light: "green",
        paragraph: "§ 119 ods. 2 TP",
      },
      {
        id: "TR-02",
        name: "Grand Power K100 (K055902, K055904)",
        lr: "1 : 25 000",
        strength: "Silná",
        light: "green",
        paragraph: "§ 119 ods. 2 TP",
      },
      {
        id: "TR-03",
        name: "Bankové výpisy VELTRA / Armivex",
        lr: "—",
        strength: "Silná",
        light: "green",
        paragraph: "§ 116 TP",
      },
      {
        id: "TR-04",
        name: "Nahrávky rozhovorov (svedok Malina)",
        lr: "—",
        strength: "Zraniteľné",
        light: "yellow",
        paragraph: "§ 115 TP",
      },
      {
        id: "TR-05",
        name: "Evidenčná kniha zbraní (stratená)",
        lr: "—",
        strength: "Procesná mína",
        light: "red",
        paragraph: "§ 98 TP",
      },
    ],
    paragraphs: [
      {
        para: "§ 294 TZ",
        title: "Nedovolené ozbrojovanie",
        status: "OK",
        note: "Znaky organizovanej skupiny naplnené",
      },
      {
        para: "§ 98 TP",
        title: "Zabezpečenie vecí",
        status: "Narušené",
        note: "Evidenčné knihy zbraní chýbajú",
      },
      {
        para: "§ 119 TP",
        title: "Zákonnosť dôkazov",
        status: "OK",
        note: "Balistická identifikácia podložená Europolom",
      },
      {
        para: "§ 125 TP",
        title: "Konfrontácia svedkov",
        status: "Príprava",
        note: "Nutná konfrontácia Novák vs. Hruška",
      },
      {
        para: "§ 168 TP",
        title: "Odôvodnenie obžaloby",
        status: "OK",
        note: "Štruktúra pripravená",
      },
    ],
  },
  judgeReadyText: {
    skutkovyStav:
      "V období od mája 2024 do augusta 2026 obvinení Peter Novák a Denis Koval po vzájomnej dohode a s presne rozdelenými úlohami založili a využili spoločnosť VELTRA s.r.o. na získanie zbrojnej licencie LA 002318. Následne od dodávateľa ARMIVEX s.r.o. odobrali 242 kusov krátkych palných zbraní, ktoré neboli riadne zaevidované v zmysle zákona o zbraniach a strelive a boli neoprávnene prevedené na neznáme osoby a do zahraničia, pričom minimálne 3 zbrane (Glock 19 v.č. CGDV051 a Grand Power K100 v.č. K055902, K055904) boli následne zaistené v kriminálnom prostredí v Španielsku.",
    vyporiadanie:
      "K otázke osobného odberu zbraní v ARMIVEX s.r.o.: Tvrdenie svedka Mareka Hrušku, že zbrane v počte 242 kusov osobne preberal Peter Novák, je v priamom procesnom rozpore (§ 125 TP) s výpoveďou Petra Nováka, ktorý toto kategoricky popiera ako klamstvo a uvádza, že v predajni v Žiline nikdy nebol, zbrane nevidel a licenciu s knihami odovzdal hneď po vydaní tretej osobe ('Ľuboš' z BB / Denis Koval). Bez písmoznaleckého posudku podpisov v knihe zbraní (§ 142 TP), bez kamerových záznamov a bez BTS lokalizácie nemožno tvrdenie svedka Hrušku považovať za preukázané. Naopak, reťazec distribúcie, prevozy a nočné odovzdávanie zbraní z kufrov vozidiel operatívne vykonával Denis Koval s ďalšími osobami (Tkáč, Slezák, Bahna), čo dokazujú zaistené pečiatky firiem, zoznamy kalibrov a výpovede svedkov Malinu a Slezáka.",
    vedecke:
      "Identifikácia zbraní zaistených v Španielsku bola potvrdená prostredníctvom národnej ústredne EUROPOL a porovnávacej balistiky Kriminalistického a expertízneho ústavu PZ s identifikačnou silou LR > 1 000 000 (pre Glock 19) a LR 1:25 000 (pre Grand Power K100), čo predstavuje mimoriadne silný vedecký dôkaz o totožnosti zbraní pochádzajúcich z dodávok spoločnosti ARMIVEX s.r.o.",
  },
  investigativeAnswers: {
    q1_buyer_seller: {
      questionNumber: 1,
      question: "1. Kto zbrane nakupoval a odovzdával?",
      answer:
        "Tvrdenie, že zbrane v počte 242 kusov osobne preberal v ARMIVEX s.r.o. Peter Novák, je sporné a v priamom rozpore so spisom (§ 125 TP): Svedok Marek Hruška (konateľ ARMIVEX) síce tvrdí, že zbrane odovzdával Novákovi na aute Audi, avšak obvinený Peter Novák toto kategoricky popiera ako klamstvo — v predajni v Žiline nikdy v živote nebol, zbrane nevidel ani nepreberal, Hrušku nepozná a zbrojnú licenciu s knihami zbraní odovzdal hneď v decembri 2024 tretej osobe ('Ľuboš' z BB / Denis Koval). K podpisom v evidenčnej knihe zbraní chýba písmoznalecký posudok (§ 142 TP), chýbajú kamerové záznamy a BTS lokalizácia mobilu. Reálnu logistiku, prevozy a nočné odovzdávanie zbraní neznámym odberateľom z kufrov áut (odpočívadlá Livinské Opatovce, Trenčín) operatívne vykonával Denis Koval s ďalšími členmi distribučnej siete (Miroslav Tkáč, Ľuboš, Norbert Slezák, Otto Bahna).",
      identifiedPersons: [
        "Peter Novák (konateľ VELTRA s.r.o. — kategoricky popiera osobný odber)",
        "Marek Hruška (konateľ ARMIVEX s.r.o. — neoverené tvrdenie o odbere bez písmoznalectva)",
        "Denis Koval (logistika, prevozy a fyzické odovzdávanie zbraní)",
        "Miroslav Tkáč & 'Ľuboš' z BB (inštruktáž, financovanie a koordinácia odberov)",
        "Norbert Slezák & Otto Bahna (disponovanie pečiatkami, zmluvami a licenciami)",
      ],
      directEvidence: [
        "Zápisnica o výsluchu Petra Nováka (kategorické popretie prítomnosti v Žiline a prevzatia zbraní)",
        "Zápisnica o výsluchu Mareka Hrušku (tvrdenie o odbere, avšak bez písmoznaleckého overenia podpisov)",
        "Zápisnica o výsluchu Denisa Kovala (potvrdenie reťazca: Tkáč, Ľubo, Bahna a odovzdávanie zbraní z kufra)",
        "Kúpne zmluvy, dodacie listy a evidenčné knihy ARMIVEX s.r.o.",
        "Zaistené pečiatky VELTRA a Bark Factory vo vozidle BMW riadenom Kovalom",
      ],
      unverifiedHypotheses: [
        "Skutočná identita osoby, ktorá s dokladmi Petra Nováka fyzicky preberala zbrane v ARMIVEXe (podozrenie na zneužitie identity alebo krytie skutočného odberateľa)",
        "Identita koncových odberateľov zbraní z kufra BMW na odpočívadle Livinské Opatovce a v Trenčíne",
        "Trasa a spôsob prevozu zaistených zbraní Glock a GP K100 do Španielska",
      ],
      missingEvidence: [
        "Písmoznalecký posudok (§ 142 TP) k pravosti podpisov v evidenčnej knihe zbraní a na preberacích protokoloch ARMIVEX s.r.o.",
        "Procesná konfrontácia podľa § 125 TP medzi Petrom Novákom a Marekom Hruškom",
        "BTS lokalizácia mobilného telefónu Petra Nováka v dňoch deklarovaných nákupov v Žiline",
        "Kamerové záznamy z predajne ARMIVEX s.r.o. a čerpacej stanice Slovnaft pri odpočívadle D1",
      ],
      confidenceLevel: 95,
    },
    q2_planner_coordinator: {
      questionNumber: 2,
      question: "2. Kto plán vymyslel a koordinoval?",
      answer:
        "Architektom a koordinátorom schémy bol Denis Koval v úzkej súčinnosti s Petrom Novákom. Koval sprostredkoval prevod prázdnej schránkovej firmy VELTRA s.r.o. cez spoločnosť Tavira s.r.o., promptne vybavil zbrojnú licenciu LA 002318 (pričom trezory boli ihneď demontované) a dojednával odbytové provízie 10–20 € za kus.",
      identifiedPersons: [
        "Denis Koval (organizátor a disponent)",
        "Peter Novák (štatutárny zástupca)",
        "Igor Malina (sprostredkovateľ / Shadowarms s.r.o.)",
      ],
      directEvidence: [
        "Zmluvná dokumentácia k prevodu obchodného podielu VELTRA s.r.o. cez Tavira s.r.o.",
        "Zvukové nahrávky rozhovorov od svedka D. Malinu dokumentujúce provízie 10-20 €/ks",
        "Správa EUROPOL o zaistení zbraní v sieti organizovaného zločinu v Španielsku",
        "Zápisnica o obhliadke prevádzky potvrdzujúca demontáž trezorov hneď po udelení licencie",
      ],
      unverifiedHypotheses: [
        "Účasť zahraničných organizátorov z Balkánskej trasy na zadávaní špecifikácií zbraní",
      ],
      missingEvidence: [
        "Forenzná extrakcia šifrovanej komunikácie (Signal/Telegram) z Kovalových telefónov",
        "Súdnoznalecké overenie autentičnosti digitálnych audio nahrávok",
      ],
      confidenceLevel: 90,
    },
    q3_financier: {
      questionNumber: 3,
      question: "3. Kto plán financoval?",
      answer:
        "Financovanie prebiehalo hybridným tokom: 71,4 % prostriedkov (106 000 €) tvorili anonymné hotovostné vklady na účet VELTRA s.r.o. v Dunajskej banke vykonávané bezprostredne pred nákupmi zbraní (technika smurfingu). Zvyšných 42 500 € tvorili bezhotovostné prevody z prepojenej entity Bark Factory s.r.o. pod rúškom fiktívnych pôžičiek.",
      identifiedPersons: [
        "Denis Koval (disponent / zdroj hotovosti)",
        "Peter Novák (majiteľ účtu VELTRA s.r.o.)",
        "Bark Factory s.r.o. (prepojená spoločnosť)",
      ],
      directEvidence: [
        "Výpisy z bankového účtu VELTRA s.r.o. v Dunajská banka a.s.",
        "Pokladničné vkladové lístky s vkladmi tesne pred nákupmi zbraní",
        "Zálohové faktúry vystavené ARMIVEX s.r.o. párované s hotovostnými vkladmi",
        "Faktúry a zmluvy o pôžičke od prepojenej firmy Bark Factory s.r.o.",
      ],
      unverifiedHypotheses: [
        "Presný pôvod vkladanej hotovosti 106 000 € (podozrenie na výnosy z distribúcie narkotík)",
      ],
      missingEvidence: [
        "Kamerové záznamy bánk z vkladomatov a pobočiek Dunajskej banky pri vkladoch",
        "Majetkové priznania a daňové priznania Kovala a Nováka za roky 2024–2025",
      ],
      confidenceLevel: 98,
    },
  },
  testimonyContradictions: ARMIVEX_CROSS_CONTRADICTIONS,
  financialAnalysis: {
    totalVolume: 148500,
    cashVolume: 106000,
    transferVolume: 42500,
    cashRatioPercent: 71.4,
    suspiciousFlows: [
      {
        id: "SF-01",
        date: "2025-01-22",
        payer: "Hotovostný vkladník (anonym)",
        recipient: "VELTRA s.r.o. (Dunajská banka)",
        amount: 32000,
        method: "cash_deposit",
        purpose: "Vklad v hotovosti na účet pred 1. tranžou",
        redFlag:
          "Vklad 32 000 € bez dokladovania pôvodu 24 hodín pred odberom v Armivexe",
      },
      {
        id: "SF-02",
        date: "2025-01-23",
        payer: "VELTRA s.r.o.",
        recipient: "ARMIVEX s.r.o.",
        amount: 31850,
        method: "wire_transfer",
        purpose: "Úhrada zálohovej faktúry (55 ks zbraní)",
        redFlag: "Okamžitý odtok čerstvo vloženej hotovosti na nákup zbraní",
      },
      {
        id: "SF-03",
        date: "2025-04-10",
        payer: "Smurfing vkladatelia (3x)",
        recipient: "VELTRA s.r.o. (Dunajská banka)",
        amount: 44000,
        method: "cash_deposit",
        purpose: "Štiepené vklady v hotovosti (14 500 € + 14 500 € + 15 000 €)",
        redFlag:
          "Štiepenie transakcií pod 15 000 € limit AML identifikácie (§ 297/2008 Z.z.)",
      },
      {
        id: "SF-04",
        date: "2025-04-11",
        payer: "VELTRA s.r.o.",
        recipient: "ARMIVEX s.r.o.",
        amount: 43200,
        method: "wire_transfer",
        purpose: "Úhrada za 80 ks pištolí Glock a Grand Power",
        redFlag:
          "Zbrane po prevzatí okamžite odvezené do nočnej distribúcie na D1",
      },
      {
        id: "SF-05",
        date: "2025-08-18",
        payer: "Vkladomat Bratislava (anonym)",
        recipient: "VELTRA s.r.o. (Dunajská banka)",
        amount: 30000,
        method: "cash_deposit",
        purpose: "Vkladomatový vklad pred 3. nákupom zbraní",
        redFlag:
          "Vklad hotovosti cez bankomat bez osobného kontaktu so zamestnancom banky",
      },
      {
        id: "SF-06",
        date: "2025-08-19",
        payer: "Bark Factory s.r.o. (Koval)",
        recipient: "VELTRA s.r.o.",
        amount: 42500,
        method: "wire_transfer",
        purpose: "Fiktívna zmluva o krátkodobej pôžičke spoločníka",
        redFlag:
          "Kreditovanie účtu cez prepojenú firmu bez zmluvného krytia a bonity",
      },
    ],
    financingConclusion:
      "Finančný mechanizmus skupiny vykazuje klasické znaky legalizácie príjmov z trestnej činnosti (pranie špinavých peňazí) podľa § 233a TZ. Zo sumy 148 500 € až 71,4 % (106 000 €) tvorili anonymné hotovostné vklady vkladané tesne pred nákupmi, s využitím techniky štiepenia (smurfing) pod limit povinnej AML identifikácie. Legálny bankový účet slúžil iba ako prechodová tranzitná stanica na premenu nelegálnej hotovosti na legálne nakúpené zbrane.",
  },
  analysisMeta: {
    promptVersion: "demo",
    model: "demo",
    createdAt: new Date().toISOString(),
    analysisStatus: "demo",
    documentIds: ["armivex-synthetic-demo"],
    sourceReferences: ["Syntetická ukážka — fiktívne údaje"],
    idempotencyKey: "demo:armivex",
    truncation: {
      inputChars: 0,
      analyzedChars: 0,
      truncated: false,
      chunkCount: 0,
      chunkLimit: 0,
      documentLimit: 0,
    },
    chunks: [],
    isDemo: true,
    heuristicModulesNote:
      "Syntetická ukážka — nie produkčný spis a nie live registry.",
  },
};
