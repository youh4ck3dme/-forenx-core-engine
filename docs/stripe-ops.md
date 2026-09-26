# Stripe / platby — ops checklist

> **Stav RC (2026-09-25):** na Vercel Production **ešte chýbajú** platobné kľúče —
> UI správne hlási „Platby nie sú nakonfigurované“. Test 4242 ostáva zaparkovaný
> podľa tohto checklistu (žiadny fake mock). Pozri `docs/STATUS-FINAL.md` → P1.

Cieľ: sandbox checklist pred ostrým predplatným. Tracking Prevention v Edge
konzole po lazy-loade klesne (menej hluku), ale **neeliminuje sa úplne** — ide
o obmedzenie prehliadača.

## 1. Stripe Dashboard

1. Účet Stripe (sandbox / test mode).
2. API keys: Publishable (`pk_test_…`) + Secret (`sk_test_…`).
3. Products / Prices: mesačný a ročný Pro plán (price IDs v `src/config/billing.ts`).

## 2. Env (lokálne + Vercel)

| Premenná | Kde | Poznámka |
| --- | --- | --- |
| `VITE_PAYMENTS_CLIENT_TOKEN` | client build | `pk_test_…` / `pk_live_…` |
| `STRIPE_SANDBOX_API_KEY` | server | `sk_test_…` (cez Lovable gateway podľa projektu) |
| `STRIPE_WEBHOOK_SECRET` | server | `whsec_…` |
| `LOVABLE_API_KEY` | server | ak gateway vyžaduje |

Žiadne reálne hodnoty do gitu — len `.env.example` placeholdery.

## 3. Webhook

- Endpoint: `/api/public/payments/webhook`
- Lokálne: `stripe listen --forward-to localhost:<port>/api/public/payments/webhook`
- Produkcia: Stripe Dashboard → Webhooks → URL nasadenej appky + rovnaký secret vo Vercel env.

## 4. Lazy-load (overenie)

1. Otvor `/predplatne` (prihlásený).
2. Network: pred klikom na plán **žiadny** request na `js.stripe.com`.
3. Klik „Vyskúšať mesačne“ / „Ročne“ → až potom sa načíta Stripe.js + Embedded Checkout.

## 5. Test karta 4242

Len ak sú sandbox keys na Vercel (`VITE_PAYMENTS_CLIENT_TOKEN`,
`STRIPE_SANDBOX_API_KEY`, webhook secret):

- Karta: `4242 4242 4242 4242`, ľubovoľný budúci dátum, CVC 123.
- Po úspechu: `/predplatne?checkout=done` a stav predplatného z API (nie len return URL).

**Stav (2026-03-25):** na Vercel projekte `forzaxteligent` zatiaľ **nie sú**
payment env keys → **blocked: missing keys**. UI správne ukáže
„Platby nie sú nakonfigurované“. Po doplnení keys zopakovať lazy-load Network
check a 4242 smoke.

**Re-check (unified backlog):** Vercel env stále len Supabase (žiadne
`VITE_PAYMENTS_*` / `STRIPE_*`) → 4242 **blocked: missing keys**.
