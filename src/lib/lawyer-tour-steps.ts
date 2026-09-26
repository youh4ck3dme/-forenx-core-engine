import {
  FileUp,
  Clock,
  ArrowRightLeft,
  Scale,
  ShieldCheck,
  FileDown,
} from "lucide-react";

export interface TourStep {
  id: number;
  title: string;
  badge: string;
  targetId: string;
  icon: typeof FileUp;
  summary: string;
  lawyerTip: string;
  proceduralParagraph?: string;
  actionLabel?: string;
}

export const LAWYER_TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    title: "1. Nahratie spisu (Drag & Drop Sandbox)",
    badge: "Krok 1 zo 6",
    targetId: "tour-upload-zone",
    icon: FileUp,
    summary:
      "Potiahnite myšou alebo nahrajte výsluchy, zmluvy, bankové výpisy či policajné protokoly (PDF, DOCX, TXT, CSV, skeny fotografií).",
    lawyerTip:
      "Vstavané OCR (Mistral OCR) automaticky prečíta a prevedie aj skenované dokumenty bez textovej vrstvy.",
    proceduralParagraph: "§ 119 ods. 1 TP",
    actionLabel: "Vyskúšať modelové dáta",
  },
  {
    id: 2,
    title: "2. Automatická časová os (Timeline)",
    badge: "Krok 2 zo 6",
    targetId: "tour-timeline",
    icon: Clock,
    summary:
      "AI z výpovedí zoradí udalosti do chronologického reťazca s presnými odkazmi na čísla listov spisu (č. l.).",
    lawyerTip:
      "Červené a žlté výstrahy okamžite identifikujú porušenia v reťazci zabezpečenia stôp — kľúčové pre námietku nezákonnosti dôkazu.",
    proceduralParagraph: "§ 98 TP a § 119 ods. 2 TP",
  },
  {
    id: 3,
    title: "3. Prepínač: Časová os ⇄ Entity a finančné toky",
    badge: "Krok 3 zo 6",
    targetId: "tour-switcher",
    icon: ArrowRightLeft,
    summary:
      "Jedným klikom prepínate medzi lineárnou časovou osou, zoznamom osôb a firiem a mapou finančných tokov (hotovosť vs. banka).",
    lawyerTip:
      "Umožňuje okamžite preukázať, kto skutočne manipuloval s peniazmi v hotovosti a kto bol len formálny nastrčený konateľ.",
    proceduralParagraph: "§ 233 TZ",
  },
  {
    id: 4,
    title: "4. Matica rozporov & Simulátor obhajoby",
    badge: "Krok 4 zo 6",
    targetId: "tour-contradictions",
    icon: Scale,
    summary:
      "Automatická konfrontačná matica (§ 125 TP) porovnáva výpovede obvinených a svedkov a počíta mieru nepravdy (85 % – 95 %).",
    lawyerTip:
      "Pripravené otázky a protiúdery pre advokáta na výsluchy svedkov, rekogníciu a znalecké dokazovanie.",
    proceduralParagraph: "§ 125 TP a § 142 TP",
  },
  {
    id: 5,
    title: "5. Právny audit a rozsudkový formát",
    badge: "Krok 5 zo 6",
    targetId: "tour-legal-audit",
    icon: ShieldCheck,
    summary:
      "Objektívne vyhodnotenie sily stôp (Likelihood Ratio > 1 000 000) a 3-zložkové rozsudkové odôvodnenie v štandarde súdneho rozhodnutia.",
    lawyerTip:
      "Obsahuje skutkový stav, vyporiadanie sa s obhajobou a vedecké zhodnotenie pripravené priamo do záverečnej reči.",
    proceduralParagraph: "§ 168 TP",
  },
  {
    id: 6,
    title: "6. 1-klikový export AI pracovnej analýzy (PDF)",
    badge: "Krok 6 zo 6",
    targetId: "tour-export-pdf",
    icon: FileDown,
    summary:
      "Vygeneruje A4 PDF s AI pracovnou analýzou (nie znalecký posudok) a SHA-256 pečaťou integrity dát.",
    lawyerTip:
      "Doložka SHA-256 overí, že vytlačený PDF zodpovedá digitálnej analýze — stále ide o pracovný materiál na overenie.",
    proceduralParagraph: "§ 168 TP a ISO/IEC 27037",
    actionLabel: "Stiahnuť AI pracovnú analýzu (PDF)",
  },
];
