# ForenX Headless Forensic Engine v1.0.0

ForenX Headless Forensic Engine is the isolated, UI-free domain core for
forensic case intake, evidence integrity, registry enrichment, privacy
protection, and court-report preparation. It contains no routes, components,
public assets, or browser application shell.

## Modules

- **Ingest and dispatcher** — validates and merges evidence into the unified
  forensic case model.
- **RPO / WhoIsWho registry** — parses Slovak official-register records,
  business activities, stakeholders, statutory data, share capital, and
  registration details.
- **S3 Vault** — server-only Hetzner S3 evidence and court-dossier archival
  with SHA-256 metadata and presigned downloads.
- **Cryptographic integrity** — canonical JSON, source references, ledgers,
  hashes, and forensic dossier provenance.
- **GDPR redactor** — minimizes and pseudonymizes personal data before AI
  processing.
- **Mistral AI Guard** — prompt-injection controls, consent boundaries, and
  resilient server-side AI/OCR integration.
- **Forensic algorithms** — transaction, relationship, anomaly, risk, and
  graph-analysis primitives.
- **Supabase schema** — migrations and RLS policies required by the persistent
  case store.

## Install and test

Requires Node.js 22 LTS and npm.

```bash
git clone git@github.com:youh4ck3dme/-forenx-core-engine.git
cd -- -forenx-core-engine
cp .env.example .env
npm ci
npx vitest run src/lib/__tests__/
```

The headless Vitest configuration excludes the three former UI-only tests that
depend on the intentionally absent component and hook layers. All core,
server-side, security, and integration tests remain in `src/lib/__tests__/`.

## Configuration

Copy `.env.example` to `.env` and set only the integrations needed for the
current environment. `.env` is ignored by Git. S3, Supabase service-role, AI,
and WhoIsWho credentials must remain server-side and must never use a `VITE_`
prefix.

## Release provenance

This initial release was exported from the verified ForenX source commit
`2837ad6` and starts a new, independent Git history.
