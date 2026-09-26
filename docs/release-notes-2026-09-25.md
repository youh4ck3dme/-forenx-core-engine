# Release Notes — 25. 9. 2026 (Forenzný Autopilot & Mistral Live)

## Súhrn vydania
Stabilná verzia Forenzný Autopilot s výhradným zameraním na Mistral API bola úspešne nasadená a naživo overená v produkcii.

## Čo je hotové a overené naživo (Live Green):
1. **Výhradne Mistral API:**
   - Klient sekundárneho poskytovateľa bol odstránený, smerovanie fixované na Mistral.
   - Podpora spoločného `MISTRAL_API_KEY` aj dedikovaných účelových kľúčov (`MISTRAL_API_KEY_CHAT`, `MISTRAL_API_KEY_ANALYSIS`).
2. **Živé overenie Autopilota & OCR (Playwright Live E2E na Production):**
   - **TXT Autopilot:** reálna analýza dávky, uloženie do spisu, reload stránky a vygenerovanie A4 PDF so SHA-256 pečaťou.
   - **Mistral OCR:** spracovanie fiktívneho skenu (PNG), OCR extrakcia textu, forenzná analýza a export.
   - **5 triážnych úloh:** všetkých 5 úloh asistenta úspešne otestovaných naživo.
3. **Robustnosť a UX:**
   - Chunk retry mechanizmus pri čiastočne zlyhaných dávkach dokumentov.
   - Štruktúrovaný `SourceRef` s formátovaním odkazu na stranu a citáciu výňatku.
   - PWA aktualizačný banner chrániaci rozpracovaný text pred nechceným obnovením.
   - Odstránenie zavádzajúceho označenia „súdny posudok“ a nahradenie za „AI pracovná analýza“.
   - Automatický výber prvého nálezu pri úlohe vysvetlenia nálezu.
   - Uvoľnenie prísnych limitov Zod schém odpovedí pre spoľahlivú validáciu.
4. **CI & QA Brána:**
   - 124/124 regresných testov prešlo.
   - Integrity suite (`test:integrity`) 54/54 PASS.
   - TypeScript typecheck prešiel s 0 chybami.
   - ESLint a produkčný PWA build plne integrované do CI workflowu.
5. **PWA live smoke (produkcia):**
   - `PLAYWRIGHT_BASE_URL=https://forzaxteligent.vercel.app` → `e2e/pwa-offline.spec.ts` **4/4 PASS**
     (SW verzia, offline.html, sw.js, offline navigácia).
6. **PDF per-finding zdroje:**
   - Chronológia, dôkazová matica a útoky obhajoby v HTML/PDF ukazujú
     `documentId · s.N · „excerpt“` cez `formatSourceRef`.
7. **Liquid Glass jednotne:**
   - Tokeny na Card, Dialog, AlertDialog a login paneli (`liquid-glass` /
     `liquid-glass-card`); toasty už mali ForenX glass.

## Čo je zaparkované na neskôr (Parked / Pending):
- **Stripe platby:** Vercel Production zatiaľ neobsahuje platobné kľúče (`VITE_PAYMENTS_CLIENT_TOKEN`, `STRIPE_SANDBOX_API_KEY`). Test 4242 zostáva bezpečne zaparkovaný podľa `docs/stripe-ops.md` bez falošnej mockovanej implementácie.
