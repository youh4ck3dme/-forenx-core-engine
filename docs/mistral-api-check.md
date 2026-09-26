# Kontrola AI — 25. 9. 2026

## Výsledok

Opravený kód bol 25. 9. 2026 nasadený na https://forzaxteligent.vercel.app
(Deployment: https://forzaxteligent-llnvv1q46-somnajviac.vercel.app).

Produkčné prostredie má nastavený platný MISTRAL_API_KEY. Všetky živé volania
AI boli kompletne overené bez mockov na produkčnej doméne s izolovaným testovacím
účtom a fiktívnymi údajmi, ktoré boli po teste riadne zmazané.

- [x] Výhradne Mistral API v kóde; odstránený klient druhého poskytovateľa.
- [x] 124 cielených regresných testov a typecheck prešli (0 chýb).
- [x] Vercel produkčný build a prepnutie hlavnej domény.
- [x] Playwright kontroly verejnej produkcie prešli: landing, auth, manifest/ikony, service worker a navigácia bez chýb prehliadača.
- [x] Platný MISTRAL_API_KEY v Production a nové nasadenie po doplnení.
- [x] Testovací účet a živé overenie autentifikovaného toku.
- [x] Úspešná analýza TXT aj PNG/OCR bez mockov vrátane uloženia a reloadu.
- [x] Úspešné overenie všetkých piatich triážnych úloh na živom Mistral API.
- [x] PDF export so SHA-256 pečaťou a označením „AI pracovná analýza“ potvrdený.
- [x] Izolované testovacie prípady po overení automaticky zmazané.

## Čo bolo nesprávne

- src/lib/ai/llm.server.ts preferoval Grok/xAI a prepínal medzi poskytovateľmi.
- src/lib/ai/xai.server.ts obsahoval chat a vision OCR klienta; súbor bol odstránený.
- src/components/malte/Assistant.tsx uvádzal Grok ako predvolený model.
- src/lib/ai.functions.ts odporúčal v chybe OCR aj iný API kľúč.
- Kontrola konfigurácie chatu mohla hlásiť dostupnosť iba na základe analysis kľúča.
- AUDIT-PROMPT.md opisoval dvoch poskytovateľov; je aktualizovaný.
  Historické AUDIT-REPORT / todo backlogy sú odstránené — aktuálny stav je
  `docs/STATUS-FINAL.md` + `docs/release-notes-2026-09-25.md`.

Implementácia lokálneho LLM, Ollama ani LM Studio sa pri prehľadaní projektu
nenašla. Jediná explicitná zmienka o lokálnom modeli bola záporná veta
v komentári ai.functions.ts; bola nahradená opisom Mistral API.
Lokálne parsovanie CSV/PDF je čítanie súborov, nie AI model.

## Mapa volaní

| Funkcia | Cesta | Poskytovateľ a kľúč |
| --- | --- | --- |
| Autopilot /asistent | runForensicAutopilot → callLlm, purpose analysis | Mistral chat/completions; MISTRAL_API_KEY_ANALYSIS alebo MISTRAL_API_KEY |
| Rýchle úlohy a štyri kontroly Sandboxu | runAiTask → callLlm, purpose chat | Mistral chat/completions; MISTRAL_API_KEY_CHAT alebo MISTRAL_API_KEY |
| OCR skenov/PDF | extractSingleBufferText → extractWithOcrFallback → callMistralOcr | Mistral files + OCR; analysis alebo spoločný kľúč |
| TXT/CSV a čitateľné PDF | textový parser | Bez volania AI |
| Základné entity v Sandboxe | parser a pravidlá v ai.functions.ts | Heuristika, nie LLM |
| Stav AI | getAiStatus → llmConfigured | Overuje kľúč pre chat, neoveruje platnosť ani kredit |
| PDF/export a hash | export-pdf.ts | Bez volania AI |

Všetky sieťové AI endpointy sú pevne na https://api.mistral.ai/v1/.
Klient dostáva výsledok, nie serverový API kľúč.
Staré premenné pre iného poskytovateľa už smerovanie nemenia.
Ich mená zostávajú len v negatívnych testoch a ochrane tajomstiev.

## Dokončenie produkčnej konfigurácie

Vo Vercel projekte forzaxteligent → Settings → Environment Variables
nastaviť platný MISTRAL_API_KEY pre Production a potom znovu nasadiť aplikáciu.
Spoločný kľúč stačí pre chat, analýzu aj OCR. Voliteľné oddelené kľúče
MISTRAL_API_KEY_CHAT a MISTRAL_API_KEY_ANALYSIS majú prednosť pre svoj účel.
Kľúč nesmie mať prefix VITE_ ani byť commitnutý do repozitára.

Až potom možno potvrdiť reálne volanie: prihlásenie, jeden fiktívny krátky TXT
cez Autopilot a jeden fiktívny sken cez OCR. Treba overiť aj platnosť kľúča,
kredit a dostupnosť modelu. Takéto live AI overenie ešte neprebehlo.

## Testy

npm run test:regression zahŕňa Mistral endpoint, Authorization header,
oddelenie účelov, spoločný kľúč, prázdne kľúče, timeout, chyby HTTP, OCR
a zákaz prepnutia poskytovateľa pri starej konfigurácii.
Sieť je mockovaná, testy nespotrebúvajú Mistral kredit.

## Spustenie pripraveného živého testu

Do ignorovaného `.env.local` lokálne doplniť testovacie prihlasovacie údaje
`E2E_USER_EMAIL` a `E2E_USER_PASSWORD`. Mistral kľúč patrí na Vercel;
testovací klient ho nepotrebuje. V PowerShell termináli:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://forzaxteligent.vercel.app"
$env:RUN_MISTRAL_LIVE = "1"
npm run test:e2e:mistral
```

Testy vykonajú platené Mistral volania. Vytvoria dva jednoznačne pomenované
`e2e-mistral-` prípady s fiktívnymi údajmi a na konci ich odstránia. Chýbajúce
credentials pri zapnutom live behu sú chyba, nie úspešné preskočenie.
Načítanie zoznamu dvoch testov a typecheck boli overené; živý beh ešte
neprebehol. Existujúci test Sandboxu už neočakáva platené AI volanie
pri obyčajnom prenose entít.
