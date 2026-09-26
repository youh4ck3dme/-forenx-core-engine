import type { TestimonyContradiction } from "./types";

/**
 * Celková krížová konfrontačná matica rozporov vo výpovediach (§ 125 Trestného poriadku)
 * Kauza: Nedovolené ozbrojovanie a obchodovanie so zbraňami (PPZ-51/UBOK-PZ-ST-2025)
 * Aktéri: Peter Novák, Marek Hruška (ARMIVEX), Igor Malina (Shadowarms), Michal Ondruš (PETRIS), Denis Koval
 */
export const ARMIVEX_CROSS_CONTRADICTIONS: TestimonyContradiction[] = [
  {
    id: "TC-01",
    topic: "Osobná prítomnosť a fyzický odber 242 zbraní v Žiline",
    personA: {
      name: "Peter Novák",
      status: "obvinený (konateľ VELTRA s.r.o.)",
      claim:
        "V predajni ARMIVEX v Žiline som nikdy nebol, zbrane som nepreberal a Mareka Hrušku v živote nevidel. Moja úloha bola len vklad na účet.",
    },
    personB: {
      name: "Marek Hruška",
      status: "svedok (konateľ ARMIVEX s.r.o.)",
      claim:
        "Peter Novák chodil po zbrane vždy sám na aute Audi, 3x osobne predložil občiansky preukaz a zbrojnú licenciu a osobne zapisoval a podpisoval zbrane do evidenčnej knihy zbraní.",
    },
    factualRecord:
      "Svedok Hruška jednoznačne stotožnil Nováka pri rekognícii in natura. V evidenčných hárkoch a knihe zbraní ARMIVEX figurujú podpisy v mene Nováka a číslo jeho platného ZP. Fyzická prítomnosť doložená aj úhradami zálohových faktúr z účtu VELTRA s.r.o.",
    deceitPercentage: 95,
    contradictionSeverity: "critical",
    proceduralResolution:
      "Vykonať konfrontáciu podľa § 125 TP medzi Novákom a Hruškom; nariadiť znalecké dokazovanie z odboru písmoznalectva (§ 142 TP) na podpisy v evidenčných knihách zbraní; zabezpečiť BTS lokalizáciu mobilu.",
  },
  {
    id: "TC-02",
    topic: "Osobná návšteva a nákupy zbraní v predajni PETRIS Nitra",
    personA: {
      name: "Peter Novák",
      status: "obvinený",
      claim:
        "Spoločnosť PETRIS-SLOVAKIA s.r.o. ani Michala Ondruša nepoznám, v Nitre som v živote nebol a žiadne zbrane odtiaľ nekupoval.",
    },
    personB: {
      name: "Michal Ondruš",
      status: "svedok (konateľ PETRIS-SLOVAKIA s.r.o.)",
      claim:
        "V auguste 2025 prišiel do predajne v Nitre Koval a spolu s ním Peter Novák v šiltovke, fotil zbrane a objednával tovar. Neskôr mi Novák cez Kovalov telefón osobne potvrdil, že zbrane prevzal a zapísal do knihy zbraní.",
    },
    factualRecord:
      "Svedok Ondruš predložil vyšetrovateľovi prefotený občiansky a vodičský preukaz Petra Nováka a dodacie listy s jeho podpisom. Telefonát cez Kovalov telefón priamo potvrdzuje Novákovo zapojenie do preberania tovaru v hodnote desiatok tisíc eur.",
    deceitPercentage: 92,
    contradictionSeverity: "critical",
    proceduralResolution:
      "Vykonať konfrontáciu podľa § 125 TP Novák vs. Ondruš; vykonať rekogníciu in natura / podľa fotografií (§ 126 TP); zabezpečiť výpisy telekomunikačnej prevádzky (§ 116 TP) medzi telefónmi Kovala, Nováka a Ondruša.",
  },
  {
    id: "TC-03",
    topic: "Disponovanie a výbery z bankomatovej karty VELTRA s.r.o.",
    personA: {
      name: "Peter Novák",
      status: "obvinený",
      claim:
        "S firemnou kartou VELTRA s.r.o. disponoval iba Ľuboš. Ja som robil len prevody a neviem o tom, že by z nej vyberal niekto iný.",
    },
    personB: {
      name: "Igor Malina",
      status: "svedok (konateľ Shadowarms s.r.o.)",
      claim:
        "Koval mi osobne odovzdal bankomatovú kartu VELTRA s.r.o. vystavenú na meno Peter Novák (č. 4234 7305 7598 2857) a 19.01.2025 som z nej osobne vybral 1 000 € na kúpu českej firmy pre Kovala. Kartu som odfotil a fotky odovzdal polícii.",
    },
    factualRecord:
      "Svedok Malina odovzdal OČTK fotografie oboch strán platobnej karty VELTRA s.r.o. vystavenej na meno Peter Novák. Bankové výpisy potvrdzujú výber hotovosti 1 000 € dňa 19.01.2025. Novák vedome umožnil obeh platobnej karty medzi neoprávnenými osobami.",
    deceitPercentage: 88,
    contradictionSeverity: "high",
    proceduralResolution:
      "Zabezpečiť výpis z bankového účtu Dunajská banka a.s. k debetnej karte č. 4234 7305 7598 2857 (§ 119 ods. 1 písm. f) TP); zabezpečiť kamerové záznamy z bankomatu z 19.01.2025; konfrontovať Nováka so zverením karty tretím osobám.",
  },
  {
    id: "TC-04",
    topic: "Rola organizátora vs. „nevinného šoféra“ a nákupy v hotovosti",
    personA: {
      name: "Denis Koval",
      status: "obvinený (spoločník Tavira s.r.o.)",
      claim:
        "Bol som len radový najatý šofér za 300–400 € na jazdu. Netušil som, čo je v taškách v kufri auta, zbrane som v živote nevidel ani nepredával.",
    },
    personB: {
      name: "Igor Malina & Michal Ondruš",
      status: "svedkovia (predajcovia zbraní)",
      claim:
        "Ondruš: Koval platil desaťtisíce eur v hotovosti (14 000 €, 17 500 €) a meral výklady, lebo budoval vlastnú predajňu. Malina: V Sučanoch mi Koval navrhol odber 300–400 zbraní mesačne so ziskom 100 €/ks a priznal nelegálnosť ďalšieho predaja (existuje nahrávka).",
    },
    factualRecord:
      "Prehliadka motorového vozidla BMW X6m a výsluchy svedkov dokazujú, že Koval disponoval stotisícovými sumami v hotovosti, dojednával nákupy stoviek zbraní a priamo plánoval ich distribúciu mimo legálny režim. Dňa 09.12.2025 si nechal poslať plnomocenstvo na prevoz zbraní na email ivankamarek.sk@gmail.com.",
    deceitPercentage: 95,
    contradictionSeverity: "critical",
    proceduralResolution:
      "Vykonať konfrontáciu Koval vs. Malina podľa § 125 TP; vykonať súdnolekárske a fonoskopické overenie audiozáznamu zo Sučian (§ 142 TP); sprísniť právnu kvalifikáciu na organizátora zločineckej skupiny podľa § 138 písm. h) TZ.",
  },
  {
    id: "TC-05",
    topic:
      "Úmyselné marenie evidencie a strata evidenčných kníh zbraní LA 002318",
    personA: {
      name: "Peter Novák & Denis Koval",
      status: "obvinení",
      claim:
        "Knihy zbraní sa stratili pri sťahovaní, alebo ich má ten druhý. Žiadnu nelegálnu distribúciu sme neorganizovali.",
    },
    personB: {
      name: "KR PZ Banská Bystrica & Ondruš",
      status: "kontrolný orgán a svedok",
      claim:
        "Trezory boli z deklarovanej predajne na ul. Vysokoškolákov v Žiline odvezené ihneď po kontrole licencie; evidencia sa na adrese nikdy neviedla a Koval pri nákupoch knihu nikdy nepredložil.",
    },
    factualRecord:
      "Spoločnosť VELTRA s.r.o. bola účelovo založená ako fiktívna prietoková entita na nákup zbraní. Úmyselné 'stratenie' kníh zbraní znemožnilo OČTK fyzicky dohľadať 242 zbraní z ARMIVEXu a desiatky Glockov z PETRISu, pričom zbraň Glock 19 (CGDV051) bola zaistená v kriminálnom prostredí v Španielsku.",
    deceitPercentage: 90,
    contradictionSeverity: "high",
    proceduralResolution:
      "Vykonať prehliadku a zaistenie vecí podľa § 89 a § 101 TP na dohľadanie evidencie zbraní; vzniesť obvinenie z marenia spravodlivosti podľa § 344 TZ a nedovoleného ozbrojovania podľa § 294 TZ.",
  },
  {
    id: "TC-06",
    topic: "Prechod na schránkovú spoločnosť Bark Factory Enterprise s.r.o.",
    personA: {
      name: "Peter Novák",
      status: "obvinený",
      claim:
        "Spoločnosť Bark Factory Enterprise s.r.o., Borinka 127, ani Filipa Flata vôbec nepoznám a o ďalších nákupoch neviem.",
    },
    personB: {
      name: "Michal Ondruš & Igor Malina",
      status: "svedkovia",
      claim:
        "Ondruš: Koval po nezhodách s Novákom plynule prešiel na firmu Bark Factory Enterprise a dal mi k telefónu Filipa Flata, ktorý to potvrdil. Malina: V aute BMW X6m po Kovalovi som našiel originál pečiatku Bark Factory a 6 faktúr PETRIS.",
    },
    factualRecord:
      "Vozidlo BMW X6m užívané Kovalom obsahovalo originálnu pečiatku Bark Factory Enterprise s.r.o. a 6 faktúr PETRIS-SLOVAKIA. Po tom, čo Novák zablokoval financie a polícia skontrolovala priestory VELTRA, skupina plynule pokračovala v nákupoch cez identický model s druhou schránkovou entitou.",
    deceitPercentage: 85,
    contradictionSeverity: "high",
    proceduralResolution:
      "Predvolať a vypočuť Filipa Flata podľa § 121 TP; vykonať konfrontáciu podľa § 125 TP; zaistiť kompletnú účtovnú a zmluvnú dokumentáciu Bark Factory Enterprise podľa § 90 TP.",
  },
];

/**
 * Vráti štatistiku a súhrn krížovej konfrontácie pre súdne potreby
 */
export function getCrossContradictionStats(
  contradictions: TestimonyContradiction[] = ARMIVEX_CROSS_CONTRADICTIONS,
) {
  const total = contradictions.length;
  const critical = contradictions.filter(
    (c) => c.contradictionSeverity === "critical",
  ).length;
  const high = contradictions.filter(
    (c) => c.contradictionSeverity === "high",
  ).length;
  const medium = contradictions.filter(
    (c) => c.contradictionSeverity === "medium",
  ).length;
  const avgDeceit =
    total > 0
      ? Math.round(
          contradictions.reduce((acc, c) => acc + c.deceitPercentage, 0) /
            total,
        )
      : 0;

  return {
    total,
    critical,
    high,
    medium,
    avgDeceitPercentage: avgDeceit,
  };
}
