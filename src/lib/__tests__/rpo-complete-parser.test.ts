import { describe, expect, it } from "vitest";
import {
  mapWhoIsWhoToCompanyRegistryProfile,
  type WhoIsWhoCompanyResponse,
} from "@/lib/whoiswho.functions";
import { parseOfficialRpoEntity } from "@/lib/rpo-parser";

/**
 * Reálny výpis RPO ŠÚ SR: Papi Hair Design, s. r. o.
 * GET https://api.statistics.sk/rpo/v1/entity/16344622
 * IČO 54684994. Licenčný text registra je vynechaný, dátové polia sú úplné.
 */
const PAPI_HAIR_RPO = {
  id: 16344622,
  identifiers: [{ value: "54684994", validFrom: "2022-06-16" }],
  fullNames: [{ value: "Papi Hair Design, s. r. o.", validFrom: "2022-06-16" }],
  addresses: [
    {
      validFrom: "2022-06-16",
      street: "Dénešova",
      regNumber: 0,
      buildingNumber: "1143/79",
      postalCodes: ["040 23"],
      municipality: {
        value: "Košice - mestská časť Sídlisko KVP",
        code: "SK0423599883",
        codelistCode: "CL000025",
      },
      country: {
        value: "Slovenská republika",
        code: "703",
        codelistCode: "CL000086",
      },
    },
  ],
  legalForms: [
    {
      value: {
        value: "Spoločnosť s ručením obmedzeným",
        code: "112",
        codelistCode: "CL000056",
      },
      validFrom: "2022-06-16",
    },
  ],
  establishment: "2022-06-16",
  activities: [
    {
      economicActivityDescription: "Pánske, dámske a detské kaderníctvo",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription:
        "Kúpa tovaru na účely jeho predaja konečnému spotrebiteľovi (maloobchod) alebo iným prevádzkovateľom živnosti (veľkoobchod)",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription:
        "Sprostredkovateľská činnosť v oblasti obchodu, služieb, výroby",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription:
        "Vykonávanie mimoškolskej vzdelávacej činnosti",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription:
        "Organizovanie športových, kultúrnych a iných spoločenských podujatí",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription:
        "Výroba chemikálií, chemických vlákien, plastov, kaučuku a prípravkov z týchto materiálov",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription:
        "Služby súvisiace s produkciou filmov, videozáznamov a zvukových nahrávok",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription:
        "Prenájom nehnuteľností spojený s poskytovaním iných než základných služieb spojených s prenájmom",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription: "Prenájom hnuteľných vecí",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription:
        "Reklamné a marketingové služby, prieskum trhu a verejnej mienky",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription: "Služby súvisiace so skrášľovaním tela",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription: "Prevádzka malých plavidiel",
      validFrom: "2022-06-16",
    },
    {
      economicActivityDescription:
        "Poskytovanie služieb rýchleho občerstvenia v spojení s predajom na priamu konzumáciu, prevádzkovanie výdajne stravy",
      validFrom: "2025-11-20",
    },
  ],
  statutoryBodies: [
    {
      stakeholderType: {
        value: "Konateľ",
        code: "3",
        codelistCode: "CL010113",
      },
      validFrom: "2022-06-16",
      personName: {
        formatedName: "Róbert Papcun",
        familyNames: ["Papcun"],
        givenNames: ["Róbert"],
      },
    },
  ],
  stakeholders: [
    {
      stakeholderType: {
        value: "Spoločník v.o.s. / s.r.o.",
        code: "99",
        codelistCode: "CL010109",
      },
      validFrom: "2022-06-16",
      address: {
        street: "Masarykova",
        regNumber: 0,
        buildingNumber: "1645/23",
        postalCodes: ["040 01"],
        municipality: {
          value: "Košice - mestská časť Staré Mesto",
          code: "SK0422598186",
          codelistCode: "CL000025",
        },
      },
      personName: {
        formatedName: "Róbert Papcun",
        familyNames: ["Papcun"],
        givenNames: ["Róbert"],
      },
    },
  ],
  authorizations: [
    {
      value: "V mene spoločnosti koná konateľ samostatne.",
      validFrom: "2022-06-16",
    },
  ],
  equities: [
    {
      validFrom: "2022-06-16",
      value: 5000,
      currency: { value: "euro", code: "EUR", codelistCode: "CL000083" },
    },
    {
      validFrom: "2022-06-16",
      valuePaid: 5000,
      currency: { value: "euro", code: "EUR", codelistCode: "CL000083" },
    },
  ],
  deposits: [
    {
      validFrom: "2022-06-16",
      personName: {
        formatedName: "Róbert Papcun",
        familyNames: ["Papcun"],
        givenNames: ["Róbert"],
      },
      type: "(peňažný vklad)",
      amount: 5000,
      currency: { value: "euro", code: "EUR", codelistCode: "CL000083" },
    },
  ],
  sourceRegister: {
    value: { value: "Obchodný register", code: "1", codelistCode: "CL010112" },
    registrationOffices: [
      { value: "Mestský súd Košice", validFrom: "2022-06-16" },
    ],
    registrationNumbers: [{ value: "Sro/54457/V", validFrom: "2022-06-16" }],
  },
  statisticalCodes: {
    mainActivity: {
      value: "Kadernícke a holičské služby",
      code: "9621",
      codelistCode: "CL010579",
    },
  },
};

describe("RPO ŠÚ SR — kompletný parser (Papi Hair Design)", () => {
  const parsed = parseOfficialRpoEntity(PAPI_HAIR_RPO);

  it("pre IČO 54684994 deterministicky extrahuje presne všetkých 13 predmetov činnosti", () => {
    const expected = [
      "Pánske, dámske a detské kaderníctvo",
      "Kúpa tovaru na účely jeho predaja konečnému spotrebiteľovi (maloobchod) alebo iným prevádzkovateľom živnosti (veľkoobchod)",
      "Sprostredkovateľská činnosť v oblasti obchodu, služieb, výroby",
      "Vykonávanie mimoškolskej vzdelávacej činnosti",
      "Organizovanie športových, kultúrnych a iných spoločenských podujatí",
      "Výroba chemikálií, chemických vlákien, plastov, kaučuku a prípravkov z týchto materiálov",
      "Služby súvisiace s produkciou filmov, videozáznamov a zvukových nahrávok",
      "Prenájom nehnuteľností spojený s poskytovaním iných než základných služieb spojených s prenájmom",
      "Prenájom hnuteľných vecí",
      "Reklamné a marketingové služby, prieskum trhu a verejnej mienky",
      "Služby súvisiace so skrášľovaním tela",
      "Prevádzka malých plavidiel",
      "Poskytovanie služieb rýchleho občerstvenia v spojení s predajom na priamu konzumáciu, prevádzkovanie výdajne stravy",
    ];
    expect(parsed.ico).toBe("54684994");
    expect(parsed.activities).toEqual(expected);
    expect(parseOfficialRpoEntity(PAPI_HAIR_RPO).activities).toEqual(expected);
  });

  it("berie meno spoločníka z personName.formatedName, nie surové ID", () => {
    expect(parsed.stakeholders).toHaveLength(1);
    expect(parsed.stakeholders[0]?.name).toBe("Róbert Papcun");
    expect(parsed.stakeholders[0]?.typeLabel).toBe("Spoločník s.r.o.");
    expect(parsed.stakeholders[0]?.depositAmount).toBe(5000);
    expect(parsed.stakeholders[0]?.paidAmount).toBe(5000);
    expect(parsed.stakeholders[0]?.currency).toBe("EUR");
    expect(
      parsed.stakeholders.map((person) => person.name).join(" "),
    ).not.toContain("company:");
  });

  it("mapuje registrový súd a číslo vložky", () => {
    expect(parsed.registrationCourt).toBe("Mestský súd Košice");
    expect(parsed.registrationNumber).toBe("Sro/54457/V");
  });

  it("mapuje základné imanie 5000 EUR, adresu, konanie a SK NACE", () => {
    expect(parsed.shareCapital?.amount).toBe(5000);
    expect(parsed.shareCapital?.currency).toBe("EUR");
    expect(parsed.shareCapital?.paidAmount).toBe(5000);
    expect(parsed.address).toBe(
      "Dénešova 1143/79, 040 23 Košice - mestská časť Sídlisko KVP",
    );
    expect(parsed.actingMethod).toBe(
      "V mene spoločnosti koná konateľ samostatne.",
    );
    expect(parsed.mainActivity).toBe("9621 - Kadernícke a holičské služby");
    expect(parsed.ico).toBe("54684994");
  });

  it("zachováva zdrojový časový rozsah podielu", () => {
    expect(parsed.stakeholders[0]).toMatchObject({
      validFrom: "2022-06-16",
      validTo: null,
    });
  });

  it("prenesie tie isté polia do profilu, ktorý vidí modal", () => {
    const response: WhoIsWhoCompanyResponse = {
      data: {
        ico: "54684994",
        name: "Papi Hair Design, s. r. o.",
        legal_form: "Spoločnosť s ručením obmedzeným",
        country: "SK",
        raw: PAPI_HAIR_RPO,
      },
      meta: {},
    };
    const profile = mapWhoIsWhoToCompanyRegistryProfile(response);
    expect(profile.businessActivities).toHaveLength(13);
    expect(profile.stakeholders?.[0]?.name).toBe("Róbert Papcun");
    expect(profile.stakeholders?.[0]?.type).toBe("Spoločník s.r.o.");
    expect(profile.registrationCourt).toBe("Mestský súd Košice");
    expect(profile.registrationNumber).toBe("Sro/54457/V");
    expect(profile.shareCapital?.amount).toBe(5000);
    expect(profile.registeredAddress).toBe(
      "Dénešova 1143/79, 040 23 Košice - mestská časť Sídlisko KVP",
    );
    expect(profile.mainActivity).toBe("9621 - Kadernícke a holičské služby");
  });
});
