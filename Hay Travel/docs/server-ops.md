# Сервер (netcup) — как всё устроено и что запускать

Продовый сервер Hay Travel: front + back + SQL на одном netcup VPS (RS 1000 G12). Заменяет
Azure. Контекст решения — [[project-hetzner-migration-plan]] (память ассистента), здесь —
практическая шпаргалка для самостоятельной работы.

## Доступ

- **IP:** `152.53.239.184`
- **Домен (HTTPS):** https://haytravel.duckdns.org — используется, пока не куплен постоянный домен
- **SSH:** `ssh -i ~/.ssh/haytravel-netcup/id_ed25519 root@152.53.239.184`
  (ключ на компьютере, где это делал ассистент; вход по паролю на сервере отключён)
- **netcup-панели:**
  - customercontrolpanel.de — счета, заказ, IP/rDNS
  - servercontrolpanel.de — управление самим сервером (перезагрузка, переустановка ОС, консоль)

## Что где лежит на сервере

```
/opt/haytravel/
├── docker-compose.yml   # описание контейнеров: sqlserver + backend
├── .env                 # секреты (пароль БД, JWT-ключ, Brevo-ключ...) — НЕ в git, chmod 600
├── uploads/              # загруженные изображения (оригинал + WebP-сжатая копия рядом),
│                          # bind-mount в backend-контейнер (/app/uploads) — переживает
│                          # docker compose up -d --build, в отличие от файловой системы контейнера
├── Backend/              # исходники .NET-бэкенда (копия, синхронизируется вручную)
└── Frontend/             # исходники фронтенда (копия, синхронизируется вручную)

/var/www/haytravel/       # собранная статика фронтенда (то, что реально отдаёт nginx)
/etc/nginx/sites-available/haytravel   # конфиг nginx (reverse proxy + TLS + /uploads/ статика)
```

**Грабля (2026-08-15):** nginx по умолчанию режет тело запроса на 1 МБ (`client_max_body_size`,
дефолт нигде явно не переопределялся). Реальное фото с телефона — 2-10 МБ, значит загрузка
файла (`api/Upload/Image`) молча падала 413 ДО того, как запрос вообще доезжал до бэкенда (у
которого свой лимит 10 МБ, `[RequestSizeLimit]` в `UploadController` — но он не срабатывал,
nginx обрывал раньше). Исправлено: `client_max_body_size 10m;` добавлен в блок `location /api/`
конфига на сервере.

Локально в репозитории (`Hay Travel/`) лежат только шаблоны без секретов:
`Backend/Dockerfile`, `docker-compose.yml`, `nginx-haytravel.conf` — источник правды на сервере,
эти файлы — просто справочная копия.

## Архитектура запроса

```
браузер → nginx (443, TLS) ──┬── /api/*      → 127.0.0.1:5253 (backend в Docker)
                              ├── /uploads/*  → /opt/haytravel/uploads/ (статика с диска, минуя .NET)
                              └── всё остальное → статика из /var/www/haytravel
backend (Docker) → sqlserver (Docker, порт наружу не торчит, только внутри docker-сети)
backend (Docker) → /app/uploads (bind-mount на /opt/haytravel/uploads — пишет туда при загрузке фото)
```

Фронт и бэк — на одном origin (один домен), поэтому cookie для refresh-токена работает без
дополнительных прокси-костылей (в отличие от старой Netlify+Azure схемы).

## Повседневные команды (все — после SSH на сервер)

**Статус контейнеров:**
```
cd /opt/haytravel && docker compose ps
```

**Логи бэкенда (живьём):**
```
docker compose -f /opt/haytravel/docker-compose.yml logs -f backend
```

**Логи БД:**
```
docker compose -f /opt/haytravel/docker-compose.yml logs -f sqlserver
```

**Перезапустить бэкенд** (например, после смены `.env`):
```
cd /opt/haytravel && docker compose up -d
```

**Зайти в БД (sqlcmd внутри контейнера):**
```
cd /opt/haytravel && source .env
docker compose exec -T sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -d ATTour
```

**Проверить, что сайт жив:**
```
curl -I https://haytravel.duckdns.org/
curl -I https://haytravel.duckdns.org/api/Tour/GetAll   # 401 — это нормально, значит роут жив
```

## Как выкатить новый код бэкенда

С локальной машины (там, где Davo ведёт разработку):
```
cd "Hay Travel"
tar --exclude='bin' --exclude='obj' -czf - Backend | \
  ssh -i ~/.ssh/haytravel-netcup/id_ed25519 root@152.53.239.184 "tar xzf - -C /opt/haytravel"
ssh -i ~/.ssh/haytravel-netcup/id_ed25519 root@152.53.239.184 \
  "cd /opt/haytravel && docker compose up -d --build"
```
EF-миграции применяются **автоматически при старте бэкенда** — отдельно накатывать не нужно.

## Как выкатить новый код фронтенда

```
cd "Hay Travel"
tar --exclude='node_modules' --exclude='dist' -czf - Frontend | \
  ssh -i ~/.ssh/haytravel-netcup/id_ed25519 root@152.53.239.184 "tar xzf - -C /opt/haytravel"
ssh -i ~/.ssh/haytravel-netcup/id_ed25519 root@152.53.239.184 'bash -s' <<'EOF'
cd /opt/haytravel/Frontend
docker run --rm -v "$(pwd)":/app -w /app node:22 sh -c "npm ci && npm run build"
rm -rf /var/www/haytravel/*
cp -r dist/* /var/www/haytravel/
EOF
```

## Секреты (`.env` на сервере)

Лежит только на сервере (`/opt/haytravel/.env`, права 600), в git не попадает.

| Переменная | Что это |
| --- | --- |
| `MSSQL_SA_PASSWORD` | пароль `sa` для контейнера SQL Server |
| `JWT_SIGNING_KEY` | ключ подписи JWT (сгенерирован заново, не совпадает с Azure) |
| `BREVO_API_KEY` | ключ Brevo для отправки писем |
| `CORS_ALLOWED_ORIGINS` | сейчас `https://haytravel.duckdns.org` |
| `PUBLIC_BASE_URL` | база для ссылок в письмах (verify/reset) |

Поменять значение → отредактировать `/opt/haytravel/.env` → `docker compose up -d`
(пересоздаст только бэкенд, БД не тронет).

## DuckDNS (домен, пока нет своего)

Если у сервера сменится IP (например, после переустановки) — обновить:
```
curl "https://www.duckdns.org/update?domains=haytravel&token=<ТВОЙ_ТОКЕН>&ip=<НОВЫЙ_IP>"
```
Токен — у Давида, в этом файле сознательно не хранится.

## HTTPS-сертификат

Let's Encrypt через certbot, автопродление уже настроено (systemd timer, ничего делать не
нужно). Проверить вручную:
```
certbot renew --dry-run
```

## Gzip

Сжатие статики и API-ответов (`/etc/nginx/nginx.conf`, глобальный блок `http {}`). `gzip on;`
включён из коробки на Ubuntu, но `gzip_types` по умолчанию закомментирован — это значит nginx
жмёт только `text/html`, а JS/CSS/JSON API уходят как есть. **Грабля (2026-08-16):** ровно
поэтому главный JS-бандл (~336 КБ) и все API-ответы отдавались несжатыми до этой даты — раскрыто
при диагностике жалобы «сайт медленный». Исправлено:

```
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_min_length 256;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript application/wasm image/svg+xml font/woff2;
```

Проверить, что реально жмётся: `curl -sI -H "Accept-Encoding: gzip" <url> | grep -i content-encoding`
(для API — через `-D -` на GET, HEAD на `/api/*` не всегда отдаёт те же заголовки).
После правки — `nginx -t` (проверка синтаксиса) и `nginx -s reload` (без даунтайма).

## Firewall / защита

- `ufw status` — открыты только 22 (SSH), 80, 443
- `fail2ban-client status sshd` — забаненные за перебор SSH IP

## Известные ограничения (пока)

- **Домен временный** (DuckDNS) — когда купите свой, перенастроить `server_name` в
  `/etc/nginx/sites-available/haytravel`, перевыпустить сертификат (`certbot --nginx -d
  <домен>`), обновить `CORS_ALLOWED_ORIGINS`/`PUBLIC_BASE_URL` в `.env`.
- **SEO-метатеги из админки не подставляются** (раньше это делала Netlify Edge Function) — см.
  [tech-debt.md](tech-debt.md).
- **Данные не перенесены из Azure** — база стартовала с нуля, сознательное решение.
