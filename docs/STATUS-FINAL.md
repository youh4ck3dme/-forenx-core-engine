# ForenX — finálny stav a backlog (2026-09-25)

**Jediný status SoT.** Staršie `todo*.md`, `roadmap.md`, audit reporty a MVP checklisty sú odstránené, aby nemýlili.

| | |
|---|---|
| **Prod** | https://forzaxteligent.vercel.app |
| **Git** | `origin/main` = `f718e0d` (*whoiswho DD regression suite in CI*) |
| **Regresia** | `npm run test:regression` → **150/150 PASS** (vrátane 26 WhoIsWho testov) |
| **Integrita** | `npm run test:integrity` → **54/54 PASS** |
| **Verdikt** | **Release Candidate** — predvedenie advokátovi OK; WhoIsWho SK DD PDF zapojené a overené; Stripe mimo scope |

---

## Master backlog (AGY + RC)

### Hotové (DONE)

| ID | Úloha | Dôkaz |
|---|---|---|
| D1–D9 / O1–O5 | RC backlog (nav, avatar, hub, CI, docs…) | main + live smoke |
| A1 | Admin quarantine → Sandbox/Autopilot z `/profil` | `7db2e2b` + SQL `20260925143000_admin_email_bizagent.sql` **aplikované na prod** (Success 2026-09-25) |
| F5 | WhoIsWho SK Due Diligence PDF download | `a41aa03` (26/26 PASS whoiswho balík v CI) + live UI smoke (`e2e/whoiswho-dd-live-smoke.spec.ts` PASS) |

### Parkované (vedomé)

| ID | Prio | Úloha | Poznámka |
|---|---|---|---|
| P1 | **P0 ops** | Stripe 4242 keys na Vercel | `docs/stripe-ops.md` |
| P2 | **P1 produkt** | Live ORSR / RPVS / Dimitri | Heuristiky + disclaimer; mimo RC |

---

## Hotové a overené (live / CI)

- Forenzný Autopilot — Mistral-only, OCR, chunk retry, `SourceRef`, auto-save
- Sandbox + CaseStartHub; admin Quarantine panel na `/profil`
- Avatar Storage + admin email/role migrácia na prod Supabase
- PWA, mobilná päta, CI lint/typecheck/build/regresia
- WhoIsWho SK Due Diligence PDF — server functions, download Blob, SHA-256 verifikácia, CI regresia (26 testov)

## Definition of „produkcia 100 %“

1. Stripe keys na Vercel + lazy Network check + 4242 PASS  
2. ~~Avatary / admin quarantine infra~~ **splnené**  
3. ~~Auth e2e päty~~ **splnené**  
4. Live registre = samostatný projekt (mimo RC)

Kým platí **P1 Stripe**, označenie ostáva **RC**.
