# ForenX — Produkčné nasadenie do Dockeru na VPS (Hetzner 2.29.52.59)

Tento návod slúži na migráciu a prevádzku **ForenX Web App** v Docker kontajneri priamo na Hetzner VPS, čím sa **úplne odstraňuje 60-sekundový limit Vercel Hobby plánu** a dlhé Autopilot analýzy (>100 s) môžu bežať bez akýchkoľvek obmedzení.

---

## 1. Architektúra služieb na VPS

Všetky služby bežia lokálne na VPS a sú chránené cez **Nginx reverse proxy** s 300-sekundovým timeoutom:

| Služba | Kontajner | Interný port | Verejná trasa cez Nginx |
|---|---|---|---|
| **ForenX Web App (nové)** | `forenx_web` | `127.0.0.1:3000` | `https://whoiswho.at/` (alebo `https://app.whoiswho.at/`) |
| **WhoIsWho SK API** | `whoiswho_api` | `127.0.0.1:8000` | `https://api.whoiswho.at/` |
| **ForenX AI Worker** | `forenx_ai` | `127.0.0.1:3001` | `https://api.whoiswho.at/forenx-ai/` |
| **PostgreSQL 16** | `whoiswho_postgres` | `5432` (interné) | iba pre WhoIsWho API |
| **ICO Atlas Scraper** | `ico_atlas` | `8080` | `https://api.whoiswho.at/atlas/` |

---

## 2. Krok za krokom: Nasadenie na VPS

Spustite cez WSL alebo SSH terminál na vašom počítači:

```bash
# 1. Pripojenie na VPS
ssh root@2.29.52.59

# 2. Vytvorenie cieľového priečinka pre ForenX
mkdir -p /opt/forenx && cd /opt/forenx

# 3. Klonovanie repozitára z GitHubu (alebo git pull ak už existuje)
git clone https://github.com/erikbabcan-commits/forzaxteligent.git .
# Ak už priečinok existuje: git pull origin main

# 4. Vytvorenie a doplnenie produkčného .env súboru
cp .env.example .env
nano .env   # overiť a doplniť kľúče (MISTRAL_API_KEY, SUPABASE_*, atď.)

# 5. Zostavenie a spustenie Docker kontajnera
docker compose up -d --build

# 6. Kontrola stavu kontajnera a logov
docker ps | grep forenx_web
docker logs -f forenx_web --tail 50
```

Overenie z VPS:
```bash
curl -I http://127.0.0.1:3000/
# Očakávaný výsledok: HTTP/1.1 200 OK (alebo 302 na /prehlad)
```

---

## 3. Nginx konfigurácia pre ForenX Web App

V `/etc/nginx/sites-available/whoiswho` (alebo v novom konfiguračnom súbore pre doménu) nasmerujte webovú prevádzku na port `3000`:

```nginx
# Blok pre ForenX Web App (whoiswho.at / www.whoiswho.at alebo app.whoiswho.at)
server {
    listen 443 ssl http2;
    server_name whoiswho.at www.whoiswho.at;

    ssl_certificate /etc/letsencrypt/live/whoiswho.at/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/whoiswho.at/privkey.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Časové limity pre dlhobežiace AI Autopilot úlohy
        proxy_connect_timeout 15s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

Po úprave konfigurácie otestujte a reloadnite Nginx:
```bash
nginx -t && systemctl reload nginx
```
*(Poznámka: Vo Windows PowerShell použite `nginx -t; systemctl reload nginx` namiesto `&&`).*

---

## 4. Výhody nasadenia na VPS oproti Vercel Hobby

1. **Neobmedzený čas behu:** Žiadny 60-sekundový timeout (Vercel Hobby strop). Autopilot môže bežať 100, 150 aj 250 sekúnd bez pádu.
2. **Nulová latencia medzi ForenX a WhoIsWho:** ForenX komunikuje s WhoIsWho API lokálne cez `127.0.0.1:8000` na tom istom serveri.
3. **Nulové náklady navyše:** Využíva sa existujúci Hetzner VPS server, ktorý už beží 24/7.
4. **Plná kontrola nad dátami a šifrovaním:** Žiadne dáta spisu neprechádzajú cez treťostranné serverless medzivrstvy.
