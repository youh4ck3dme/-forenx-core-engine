# ForenX Headless Core Engine

This repository contains only the headless forensic domain engine. Do not add
application routes, React components, public assets, browser state hooks, or
production deployment configuration here.

## Quality gate

Before publishing a change, run:

```bash
npm ci
npx vitest run src/lib/__tests__/
```

The Vitest configuration deliberately excludes tests that require the absent
web shell, PWA assets, Vercel configuration, or non-versioned real evidence.
All domain, storage, security, GDPR, registry, and server-side integration
tests must pass.

## Secrets

Never commit `.env`, `.env.local`, cloud credentials, API keys, uploaded
evidence, or generated forensic reports. Use `.env.example` only as the public
configuration contract. Server-only keys must never use a `VITE_` prefix.

## Git protocol

Use conventional, standalone commits. Never rewrite published history through
force-pushes, rebases, or amended published commits.
