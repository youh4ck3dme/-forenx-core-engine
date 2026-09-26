# Regresné testy Autopilota, Sandboxu a PDF

V termináli Cursoru v koreni projektu:

```sh
npm ci
npm run test:regression
npm run typecheck
npm run lint
npm run build
```

Pri už nainštalovaných závislostiach stačí začať príkazom
`npm run test:regression`. Cielené opakovanie UI testov:
`npx vitest run assistant-regression sandbox-regression`.

## Rozsah

| Oblasť | Regresná ochrana |
| --- | --- |
| Autopilot | Skutočný orchestrátor, parser a merge nad mockovaným LLM a databázou; upload textu, OCR hranica, retry, timeout bez retry, chybný JSON, partial, úplné zlyhanie, limit 80k a chunky 25k |
| Metadata | Model, promptVersion, documentIds, zdroje, stav, truncation, idempotencyKey odlišný pri zmene prípadu/textu/promptu |
| Save | Uloženie presného dossieru, chyba DB aj výnimka, Retry bez ďalšieho AI volania, serverový a UI guard dema |
| Assistant UI | Skutočne renderovaný React komponent v jsdom; upload, súhlas, auto-save success/error, Retry, demo PDF, persistované partial upozornenie |
| Sandbox UI | Extrakcia → výslovný apply entít → refresh; štyri kontroly v poradí; link na /asistent; žiadne volanie full Autopilota |
| PDF | HTML určené na tlač: model, prompt, zdroje, status, truncation, AI doložka a demo označenie; SHA-256 voči node:crypto aj zmenám vnorených dôkazov |
| Branding/PWA | Rozmery a RGBA nových PNG, manifest a service-worker invarianty |

Fixtures v `src/test-fixtures/autopilot.ts` sú fiktívne, bez osobných údajov.
Nové integračné a UI testy blokujú globálny fetch a mockujú hranice AI/DB;
nepotrebujú API kľúče, účet ani produkčné dáta. Testuje sa aj skutočné
renderovanie a klikanie komponentov, nie iba prítomnosť textu v zdrojáku.
Rozpracovaný nespracovaný text spisu a chunky sú držané v pamäti relácie prehliadača;
po úplnom obnovení stránky (F5) pred uložením je potrebné súbor nahrať znova.

GitHub Actions workflow `.github/workflows/regression.yml` spúšťa túto sadu
a typecheck pri push/PR. Nepoužíva produkčné secrets.

Voliteľný live Autopilot E2E (mimo CI): `e2e/autopilot-live.spec.ts` beží len
s `E2E_AUTOPILOT_LIVE=1`, `PLAYWRIGHT_BASE_URL` na nasadenú app a `E2E_USER_*`.
Bez flagu sa testy skipnú a CI ostáva zelené.

Mobilná päta (5 slotov Prípady·Autopilot·Sandbox·Zistenia·Viac): unit
`nav-groups.test.ts` + lokálny Playwright v `e2e/critical-flows.spec.ts`
(Dev Free Entry, viewport 390×844). Public smoke na produkcii pätu nepokrýva.
Badge na Zisteniach je podmienený critical alertami — bez seedu sa v smoke
neassertuje číslo, len prítomnosť slotu a navigácia na `/vztahy`.
Štruktúrovaný `sourceRef` / `sourceReferences` je pokrytý unit testami
(`autopilot-meta`, regresia); PDF export zobrazuje per-finding zdroj
(chronológia, stopy, útoky obhajoby). Plný platený live Autopilot re-run nie je
súčasťou tejto sady (overené v release notes 2026-09-25).

## PWA live smoke (produkcia)

Spustiť proti aliasu:

```sh
PLAYWRIGHT_BASE_URL=https://forzaxteligent.vercel.app npx playwright test e2e/pwa-offline.spec.ts --project=chromium --workers=1
```

**Stav (unified backlog):** 4/4 PASS — SW verzia, `/offline.html`, produkčný
`/sw.js`, navigácia offline → offline fallback. Lokálny
`e2e/pwa-update.spec.ts` (waiting update + SKIP_WAITING) ostáva samostatný.

## Opravy odhalené testami

- SHA-256 dossieru predtým ignoroval vnorené polia. Serializácia teraz
  rekurzívne triedi kľúče a zahŕňa dôkazy aj metadata. Odtlačky novo
  exportovaných reportov sa preto líšia od starších exportov.
- Po načítaní uloženého partial dossieru chýbalo upozornenie. UI ho teraz
  odvodzuje priamo z uloženého analysisMeta.analysisStatus.

## Čo táto sada nepotvrdzuje

Nejde o live E2E s reálnym prihlásením, Supabase RLS, OCR poskytovateľom a LLM.
Mock databázy nepotvrdzuje produkčné oprávnenia; test vnútorného handlera
nenahrádza test autentifikačného middleware. OCR test overuje smerovanie a
spracovanie výsledku, nie kvalitu rozpoznania skenu. PDF test kontroluje
tlačové HTML a hash, nie binárny PDF súbor ani dialóg tlače.

IdempotencyKey je testovaný ako stabilná identita vstupu, nie ako garancia
jediného plateného AI volania pri opakovanom spustení. Faktickú správnosť
LLM, živé registre ani tvrdenia o právnej dôkazovej sile testy nepotvrdzujú.
