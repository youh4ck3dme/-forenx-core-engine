/** Rozšírené procesné postavenie osôb a subjektov v trestnom konaní. */

export type PersonTypeId =
  | "suspect"
  | "accused"
  | "convicted"
  | "witness"
  | "cooperating_witness"
  | "victim"
  | "injured_party"
  | "expert"
  | "interpreter"
  | "defence_counsel"
  | "legal_entity"
  | "statutory_body"
  | "beneficial_owner"
  | "straw_man"
  | "third_party_affected"
  | "unknown";

export type PersonType = {
  id: PersonTypeId;
  label: string;
  /** Procesná rola v skratke. */
  description: string;
  /** Ustanovenia Trestného poriadku, ktoré rolu rámcujú. */
  procedural: string[];
  /** Naznačuje podozrenie z trestnej činnosti (ovplyvňuje posúdenie). */
  suspectLike: boolean;
};

export const PERSON_TYPES: Record<PersonTypeId, PersonType> = {
  suspect: {
    id: "suspect",
    label: "Podozrivý",
    description:
      "Osoba, voči ktorej smeruje podozrenie pred vznesením obvinenia.",
    procedural: ["§ 85", "§ 196"],
    suspectLike: true,
  },
  accused: {
    id: "accused",
    label: "Obvinený",
    description: "Osoba, ktorej bolo vznesené obvinenie.",
    procedural: ["§ 33", "§ 34"],
    suspectLike: true,
  },
  convicted: {
    id: "convicted",
    label: "Odsúdený",
    description: "Osoba s právoplatným odsudzujúcim rozsudkom.",
    procedural: ["§ 406"],
    suspectLike: true,
  },
  witness: {
    id: "witness",
    label: "Svedok",
    description: "Osoba vypovedajúca o skutočnostiach dôležitých pre konanie.",
    procedural: ["§ 127", "§ 130"],
    suspectLike: false,
  },
  cooperating_witness: {
    id: "cooperating_witness",
    label: "Spolupracujúci svedok",
    description:
      "Svedok so zvláštnou ochranou pri usvedčovaní organizovanej skupiny.",
    procedural: ["§ 136", "§ 218"],
    suspectLike: false,
  },
  victim: {
    id: "victim",
    label: "Obeť",
    description: "Osoba, ktorej bola trestným činom spôsobená ujma.",
    procedural: ["§ 46"],
    suspectLike: false,
  },
  injured_party: {
    id: "injured_party",
    label: "Poškodený",
    description: "Subjekt uplatňujúci nárok na náhradu škody.",
    procedural: ["§ 46", "§ 287"],
    suspectLike: false,
  },
  expert: {
    id: "expert",
    label: "Znalec",
    description: "Osoba podávajúca odborný posudok (balistika, účtovníctvo).",
    procedural: ["§ 141", "§ 143"],
    suspectLike: false,
  },
  interpreter: {
    id: "interpreter",
    label: "Tlmočník / prekladateľ",
    description: "Zabezpečuje porozumenie v cudzojazyčnom konaní.",
    procedural: ["§ 28"],
    suspectLike: false,
  },
  defence_counsel: {
    id: "defence_counsel",
    label: "Obhajca",
    description: "Advokát zastupujúci obvineného.",
    procedural: ["§ 36", "§ 44"],
    suspectLike: false,
  },
  legal_entity: {
    id: "legal_entity",
    label: "Právnická osoba",
    description:
      "Subjekt s možnou trestnou zodpovednosťou podľa zák. 91/2016 Z. z.",
    procedural: ["§ 3 zák. 91/2016"],
    suspectLike: true,
  },
  statutory_body: {
    id: "statutory_body",
    label: "Štatutárny orgán",
    description: "Konateľ alebo člen orgánu zodpovedný za konanie spoločnosti.",
    procedural: ["§ 34"],
    suspectLike: true,
  },
  beneficial_owner: {
    id: "beneficial_owner",
    label: "Konečný užívateľ výhod",
    description: "Osoba skutočne profitujúca z činnosti spoločnosti.",
    procedural: ["§ 6a zák. 297/2008"],
    suspectLike: true,
  },
  straw_man: {
    id: "straw_man",
    label: "Biely kôň",
    description: "Formálny štatutár bez reálneho rozhodovania, krycia osoba.",
    procedural: ["§ 34", "§ 130"],
    suspectLike: true,
  },
  third_party_affected: {
    id: "third_party_affected",
    label: "Zúčastnená osoba",
    description: "Osoba dotknutá zaistením majetku bez postavenia obvineného.",
    procedural: ["§ 45"],
    suspectLike: false,
  },
  unknown: {
    id: "unknown",
    label: "Neurčené postavenie",
    description: "Procesné postavenie zatiaľ nebolo určené.",
    procedural: [],
    suspectLike: false,
  },
};

export const PERSON_TYPE_LIST: PersonType[] = Object.values(PERSON_TYPES);

export function personType(id: PersonTypeId | string | undefined): PersonType {
  return (
    PERSON_TYPES[(id as PersonTypeId) ?? "unknown"] ?? PERSON_TYPES.unknown
  );
}
