/**
 * Peňažná aritmetika s pevnou presnosťou.
 *
 * Konvencia znamienok: suma transakcie je *podpísaná* a vždy sa vzťahuje na smer
 * `fromId → toId`. Kladná suma = peniaze odišli od `fromId` k `toId`.
 * Záporná suma = opačný tok (storno, vrátka, odchádzajúca korekcia) — je povolená.
 * Pre objemové ukazovatele sa preto používa absolútna hodnota.
 *
 * Rôzne meny sa nikdy nesčítavajú do jednej sumy. Súčty sa počítajú vždy
 * per mena; „objem prípadu" je objem v základnej mene prípadu.
 */

export const MONEY_SCALE = 2;

/** Zaokrúhli na 2 desatinné miesta (half-up na kladných aj záporných hodnotách). */
export function roundMoney(value: number): number {
  const factor = 10 ** MONEY_SCALE;
  // toPrecision odstráni binárnu odchýlku (1.005 je v plávajúcej čiarke 1.00499…),
  // aby zaokrúhlenie zodpovedalo desatinnému zápisu, ktorý zadal používateľ.
  const scaled = Number((Math.abs(value) * factor).toPrecision(12));
  return (Math.sign(value) * Math.round(scaled)) / factor;
}

/** Súčet v jednej mene — sčítava v centoch, aby nevznikala chyba plávajúcej čiarky. */
export function sumMoney(values: number[]): number {
  const cents = values.reduce(
    (sum, value) => sum + Math.round(value * 10 ** MONEY_SCALE),
    0,
  );
  return cents / 10 ** MONEY_SCALE;
}

/** Objem = súčet absolútnych hodnôt (smer neurčuje veľkosť toku). */
export function sumVolume(values: number[]): number {
  return sumMoney(values.map((value) => Math.abs(value)));
}

/** Rozdelí sumy podľa meny. Nikdy nekonvertuje — konverzia musí byť explicitná. */
export function sumByCurrency<T extends { amount: number; currency: string }>(
  items: T[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = item.currency || "EUR";
    out[key] = sumMoney([out[key] ?? 0, Math.abs(item.amount)]);
  }
  return out;
}

export function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: MONEY_SCALE,
  }).format(value);
}
