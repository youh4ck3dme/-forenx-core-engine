/**
 * Parser oficiálneho výpisu RPO ŠÚ SR (api.statistics.sk / WhoIsWho SK).
 * Názvy polí sú tie, ktoré register skutočne posiela — vrátane preklepu
 * `formatedName` v objekte personName.
 */

export type RpoStakeholder = {
  name: string;
  /** Úradný text, napr. „Spoločník v.o.s. / s.r.o.“ */
  type: string | null;
  /** Text do UI a PDF, napr. „Spoločník s.r.o.“ */
  typeLabel: string | null;
  address: string | null;
  depositAmount: number | null;
  paidAmount: number | null;
  currency: string | null;
  validFrom: string | null;
  validTo: string | null;
};

export type RpoDeposit = {
  personName: string;
  type: string | null;
  amount: number | null;
  currency: string | null;
};

export type RpoShareCapital = {
  amount: number;
  currency: string;
  paidAmount: number | null;
};

export type OfficialRpoRecord = {
  ico: string | null;
  rpoId: number | null;
  name: string | null;
  legalForm: string | null;
  address: string | null;
  activities: string[];
  stakeholders: RpoStakeholder[];
  deposits: RpoDeposit[];
  shareCapital: RpoShareCapital | null;
  registrationCourt: string | null;
  registrationNumber: string | null;
  actingMethod: string | null;
  /** „9621 - Kadernícke a holičské služby“ */
  mainActivity: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
    return String(value);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed === "0") return null;
  return trimmed;
}

function amount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }
  return null;
}

function currencyCode(value: unknown): string | null {
  const record = asRecord(value);
  const code = text(record?.["code"]);
  if (code) return code.toUpperCase() === "EUR" ? "EUR" : code.toUpperCase();
  const label = text(record?.["value"]);
  if (label && label.toLowerCase() === "euro") return "EUR";
  return label;
}

function codedValue(value: unknown): string | null {
  const record = asRecord(value);
  return text(record?.["value"]) ?? text(value);
}

function rpoDate(value: unknown): string | null {
  const candidate = text(value);
  return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)
    ? candidate
    : null;
}

/** Ulica + číslo, PSČ a obec v tvare, aký používa RPO. */
export function formatRpoAddress(value: unknown): string | null {
  const address = asRecord(value);
  if (!address) return null;
  const street = text(address["street"]);
  const building =
    text(address["buildingNumber"]) ?? text(address["regNumber"]);
  const streetLine = [street, building].filter(Boolean).join(" ");
  const postalCodes = address["postalCodes"];
  const postal = Array.isArray(postalCodes) ? text(postalCodes[0]) : null;
  const municipality = codedValue(address["municipality"]);
  const locality = [postal, municipality].filter(Boolean).join(" ");
  const full = [streetLine, locality].filter(Boolean).join(", ");
  return full || null;
}

function personName(value: unknown): string | null {
  const person = asRecord(value);
  if (!person) return null;
  const formatted =
    text(person["formatedName"]) ?? text(person["formattedName"]);
  if (formatted) return formatted;
  const given = Array.isArray(person["givenNames"])
    ? text(person["givenNames"][0])
    : null;
  const family = Array.isArray(person["familyNames"])
    ? text(person["familyNames"][0])
    : null;
  const joined = [given, family].filter(Boolean).join(" ");
  return joined || null;
}

function stakeholderTypeLabel(
  type: string | null,
  legalForm: string | null,
): string | null {
  if (!type) return null;
  if (type === "Spoločník v.o.s. / s.r.o." && legalForm) {
    if (/ručením obmedzeným|s\.?\s*r\.?\s*o\.?/i.test(legalForm)) {
      return "Spoločník s.r.o.";
    }
  }
  return type;
}

function looksLikeOfficialRpo(record: Record<string, unknown>): boolean {
  const activities = record["activities"];
  if (
    Array.isArray(activities) &&
    activities.some((item) => asRecord(item)?.["economicActivityDescription"])
  ) {
    return true;
  }
  return (
    Array.isArray(record["identifiers"]) &&
    (Array.isArray(record["fullNames"]) ||
      Array.isArray(record["stakeholders"]))
  );
}

export function parseOfficialRpoEntity(entity: unknown): OfficialRpoRecord {
  const root = asRecord(entity) ?? {};
  const identifiers = Array.isArray(root["identifiers"])
    ? root["identifiers"]
    : [];
  const ico = text(asRecord(identifiers[0])?.["value"]) ?? text(root["ico"]);
  const fullNames = Array.isArray(root["fullNames"]) ? root["fullNames"] : [];
  const lastName = asRecord(fullNames[fullNames.length - 1]);
  const name = text(lastName?.["value"]) ?? text(root["name"]);
  const legalForms = Array.isArray(root["legalForms"])
    ? root["legalForms"]
    : [];
  const legalForm = codedValue(
    asRecord(legalForms[legalForms.length - 1])?.["value"],
  );

  const activities = (
    Array.isArray(root["activities"]) ? root["activities"] : []
  )
    .map((item) => text(asRecord(item)?.["economicActivityDescription"]))
    .filter((item): item is string => item !== null);

  const addresses = Array.isArray(root["addresses"]) ? root["addresses"] : [];
  const address = formatRpoAddress(addresses[0]);

  const deposits = (Array.isArray(root["deposits"]) ? root["deposits"] : [])
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const person = personName(row["personName"]);
      if (!person) return null;
      const parsed: RpoDeposit = {
        personName: person,
        type: text(row["type"]),
        amount: amount(row["amount"]),
        currency: currencyCode(row["currency"]),
      };
      return parsed;
    })
    .filter((item): item is RpoDeposit => item !== null);

  const equities = Array.isArray(root["equities"]) ? root["equities"] : [];
  let capitalAmount: number | null = null;
  let paidAmount: number | null = null;
  let capitalCurrency: string | null = null;
  for (const item of equities) {
    const row = asRecord(item);
    if (!row) continue;
    const value = amount(row["value"]);
    const paid = amount(row["valuePaid"]);
    const currency = currencyCode(row["currency"]);
    if (value !== null) capitalAmount = value;
    if (paid !== null) paidAmount = paid;
    if (currency) capitalCurrency = currency;
  }
  const shareCapital =
    capitalAmount !== null
      ? {
          amount: capitalAmount,
          currency: capitalCurrency ?? "EUR",
          paidAmount,
        }
      : null;

  const depositByName = new Map(
    deposits.map((deposit) => [deposit.personName.toLowerCase(), deposit]),
  );

  const stakeholders = (
    Array.isArray(root["stakeholders"]) ? root["stakeholders"] : []
  )
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const name =
        personName(row["personName"]) ??
        text(row["fullName"]) ??
        text(row["companyName"]);
      if (!name || name.startsWith("company:") || name.startsWith("person:")) {
        return null;
      }
      const type = codedValue(row["stakeholderType"]);
      const deposit = depositByName.get(name.toLowerCase());
      const soleDeposit = deposits.length === 1 ? deposits[0] : undefined;
      const matched =
        deposit ??
        (stakeholdersMatchSole(name, soleDeposit) ? soleDeposit : undefined);
      const parsed: RpoStakeholder = {
        name,
        type,
        typeLabel: stakeholderTypeLabel(type, legalForm),
        address: formatRpoAddress(row["address"]),
        depositAmount: matched?.amount ?? null,
        paidAmount:
          matched && deposits.length === 1
            ? (shareCapital?.paidAmount ?? matched.amount)
            : null,
        currency: matched?.currency ?? shareCapital?.currency ?? null,
        validFrom: rpoDate(row["validFrom"]),
        validTo: rpoDate(row["validTo"]),
      };
      return parsed;
    })
    .filter((item): item is RpoStakeholder => item !== null);

  const sourceRegister = asRecord(root["sourceRegister"]);
  const offices = Array.isArray(sourceRegister?.["registrationOffices"])
    ? sourceRegister["registrationOffices"]
    : [];
  const numbers = Array.isArray(sourceRegister?.["registrationNumbers"])
    ? sourceRegister["registrationNumbers"]
    : [];
  const authorizations = Array.isArray(root["authorizations"])
    ? root["authorizations"]
    : [];
  const statistical = asRecord(root["statisticalCodes"]);
  const main = asRecord(statistical?.["mainActivity"]);
  const naceCode = text(main?.["code"]);
  const naceLabel = text(main?.["value"]);
  const mainActivity =
    naceCode && naceLabel
      ? `${naceCode} - ${naceLabel}`
      : (naceLabel ?? naceCode);

  const rpoId = amount(root["id"]);

  return {
    ico,
    rpoId: rpoId !== null ? Math.trunc(rpoId) : null,
    name,
    legalForm,
    address,
    activities,
    stakeholders,
    deposits,
    shareCapital,
    registrationCourt: text(asRecord(offices[0])?.["value"]),
    registrationNumber: text(asRecord(numbers[0])?.["value"]),
    actingMethod: text(asRecord(authorizations[0])?.["value"]),
    mainActivity,
  };
}

function stakeholdersMatchSole(
  name: string,
  sole: RpoDeposit | undefined,
): sole is RpoDeposit {
  return Boolean(sole && sole.personName.toLowerCase() === name.toLowerCase());
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item))
    .filter((item): item is string => item !== null);
}

/** Konsolidovaný záznam WhoIsWho (stĺpec raw) alebo priamo entita RPO. */
export function rpoDetailsFromUnknown(raw: unknown): OfficialRpoRecord | null {
  const record = asRecord(raw);
  if (!record) return null;
  if (looksLikeOfficialRpo(record)) return parseOfficialRpoEntity(record);
  const embedded = asRecord(record["rpo_entity"]);
  if (embedded && looksLikeOfficialRpo(embedded)) {
    return parseOfficialRpoEntity(embedded);
  }

  const activities = stringList(record["business_activities"]);
  const address = text(record["full_address"]);
  const court = text(record["registration_court"]);
  const registrationNumber = text(record["registration_number"]);
  const actingMethod = text(record["acting_method"]);
  const mainActivity = text(record["sk_nace"]) ?? text(record["main_activity"]);
  const capital = amount(record["equity_amount"]);
  if (
    activities.length === 0 &&
    !address &&
    !court &&
    !registrationNumber &&
    !actingMethod &&
    !mainActivity &&
    capital === null &&
    !Array.isArray(record["stakeholders"])
  ) {
    return null;
  }

  const currency = text(record["equity_currency"]) ?? "EUR";
  const stakeholders = (
    Array.isArray(record["stakeholders"]) ? record["stakeholders"] : []
  )
    .map((item) => {
      const row = asRecord(item);
      const name = text(row?.["name"]);
      if (
        !row ||
        !name ||
        name.startsWith("company:") ||
        name.startsWith("person:")
      ) {
        return null;
      }
      const type = text(row["type"]);
      const typeLabel =
        text(row["type_label"]) ??
        stakeholderTypeLabel(type, text(record["legal_form"]));
      const parsed: RpoStakeholder = {
        name,
        type,
        typeLabel,
        address: text(row["address"]),
        depositAmount: amount(row["deposit_amount"]),
        paidAmount: amount(row["paid_amount"]),
        currency: text(row["currency"]),
        validFrom: null,
        validTo: null,
      };
      return parsed;
    })
    .filter((item): item is RpoStakeholder => item !== null);

  return {
    ico: text(record["ico"]),
    rpoId: null,
    name: text(record["name"]),
    legalForm: text(record["legal_form"]),
    address,
    activities,
    stakeholders,
    deposits: [],
    shareCapital:
      capital !== null
        ? {
            amount: capital,
            currency: currency.toUpperCase() === "EURO" ? "EUR" : currency,
            paidAmount: amount(record["equity_paid"]),
          }
        : null,
    registrationCourt: court,
    registrationNumber,
    actingMethod,
    mainActivity,
  };
}

export function formatRegistryMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value))
    return null;
  const code =
    !currency || currency.toLowerCase() === "euro" ? "EUR" : currency;
  const formatted = new Intl.NumberFormat("sk-SK", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
  return `${formatted} ${code}`;
}
