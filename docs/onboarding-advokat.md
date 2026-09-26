# ForenX — krátky onboarding pre advokáta

**URL:** https://forzaxteligent.vercel.app  
**Prihlásenie:** `/auth` → e-mail a heslo (heslo posiela Erik osobne, nie v tomto dokumente).

## Čo kde

| Miesto | Účel |
| --- | --- |
| **Prehľad** (`/prehlad`) | Stav aktívneho prípadu |
| **Forenzný Autopilot** (`/asistent`) | Nahrať spis → AI pracovná analýza → uloženie / PDF |
| **Sandbox** (`/sandbox`) | Entity a kontroly; nie plný Autopilot |
| **Prípady** (`/pripady`) | Vytvorenie a správa prípadov |
| **Menu účtu** (ikona v headri) | Profil, Predplatné, Odhlásenie → úvod `/` |

## Autopilot vs Sandbox

- **Autopilot** = jeden tok: drop súborov → jedna obrazovka výsledku → export.
- **Sandbox** = práca s entitami a kontrolami; spis na plnú AI analýzu otvoríte cez odkaz na Autopilot.

Po **vytvorení nového prípadu** sa otvorí Prehľad s voľbou Autopilot / Sandbox (nie slepý skok len do Sandboxu).

## Dôležité upozornenie

Výstup AI je **pracovná analýza na overenie**, nie súdny znalecký posudok.  
Registry / cross-border signály sú **heuristiky z textu spisu**, nie live ORSR / RPVS.
