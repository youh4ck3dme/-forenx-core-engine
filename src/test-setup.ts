/**
 * Testy nikdy nesmú volať skutočných poskytovateľov AI.
 * Pred každým testovacím súborom odstránime všetky kľúče z prostredia;
 * jednotlivé testy si nastavia vlastné fiktívne hodnoty, keď ich potrebujú.
 */
delete process.env["MISTRAL_API_KEY"];
delete process.env["MISTRAL_API_KEY_CHAT"];
delete process.env["MISTRAL_API_KEY_ANALYSIS"];
delete process.env["XAI_API_KEY"];
