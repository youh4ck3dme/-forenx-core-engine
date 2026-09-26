# Produkčná migrácia — overenie

**Cieľ:** stĺpce z `supabase/migrations/20260916151306_bd620097-876e-4494-adef-f027bd3690d3.sql`
na tabuľke `cases`:

- `forensic_dossier` (jsonb)
- `forensic_dossier_updated_at` (timestamptz)

**Overenie (PostgREST, anon key):**

```http
GET /rest/v1/cases?select=forensic_dossier,forensic_dossier_updated_at&limit=1
```

- HTTP **200** + JSON pole → stĺpce existujú (aj pri 0 riadkoch).
- Chyba typu `PGRST204` / „column … does not exist“ → migrácia na prod chýba.

**Stav (unified backlog):** overené na produkčnom Supabase projektu via
`VITE_SUPABASE_URL` → **PASS** (HTTP 200, prázdny výsledok `[]`).

---

## Avatar Storage bucket (`avatars`)

Migrácia: `supabase/migrations/20260925140000_avatars_storage_bucket.sql`

**Overenie (service role / dashboard):**

1. Storage → bucket `avatars` existuje, `public = true`, limit 512 KiB.
2. Aplikácia nahráva cez server fn `uploadMyAvatar` (service role) — funguje aj bez client RLS policies.
3. Voliteľne: aplikovať RLS policies zo SQL migrácie v Supabase SQL Editori (defense in depth).

**Stav (2026-09-25):** bucket na prod **existuje**; upload opravený server-side.
