export function assertStrictLocalDatabaseUrl(
  dbUrl: string | undefined,
): string {
  if (!dbUrl || typeof dbUrl !== "string" || dbUrl.trim() === "") {
    throw new Error(
      "Bezpečnostná ochrana: TEST_DATABASE_URL nie je definovaná. Testovací runner odmieta neurčenú databázu.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch (err: any) {
    throw new Error(
      `Bezpečnostná ochrana: Neplatná URL adresa databázy (${dbUrl}): ${err.message}`,
    );
  }
  const hostname = parsed.hostname.toLowerCase();
  const isLocal =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (!isLocal) {
    throw new Error(
      `BEZPEČNOSTNÝ STOP: Testovací runner odmieta vzdialenú alebo produkčnú databázu (${hostname})! Povolený je výhradne izolovaný lokálny PostgreSQL (localhost/127.0.0.1).`,
    );
  }
  return dbUrl;
}
