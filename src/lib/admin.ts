/**
 * Admin allowlist — e-maily oddelené čiarkou v FORENX_ADMIN_EMAILS
 * (napr. info@bizagent.sk). Lokálne: FORENX_ADMIN_LOCAL=1 povolí aj
 * dev@forendo.local (Dev Free Entry).
 */

export function parseAdminEmails(
  raw: string | undefined = process.env["FORENX_ADMIN_EMAILS"],
): Set<string> {
  const set = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const e = part.trim().toLowerCase();
    if (e.includes("@")) set.add(e);
  }
  return set;
}

export function isAdminEmail(
  email: string | null | undefined,
  opts?: { emails?: Set<string>; allowLocal?: boolean },
): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  const allowLocal =
    opts?.allowLocal ??
    (process.env["NODE_ENV"] !== "production" &&
      process.env["FORENX_ADMIN_LOCAL"] === "1");
  if (allowLocal && normalized === "dev@forendo.local") return true;
  const emails = opts?.emails ?? parseAdminEmails();
  return emails.has(normalized);
}

export function claimEmail(claims: unknown): string | null {
  if (!claims || typeof claims !== "object") return null;
  const email = (claims as { email?: unknown }).email;
  return typeof email === "string" ? email : null;
}
