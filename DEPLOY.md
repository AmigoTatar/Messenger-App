# Деплой VPS + release APK

## VPS (Server-Refactor)

1. Залей код на сервер.
2. `.env` на VPS: возьми текущий прод-файл и **добавь/поправь**:
   ```
   NODE_ENV=production
   FRONTEND_URL=https://potokmessenger.ru
   CORS_ORIGINS=https://potokmessenger.ru,https://www.potokmessenger.ru,https://localhost,http://localhost,capacitor://localhost
   RUSTORE_PROJECT_ID=...   # тот же, что в strings.xml
   RUSTORE_SERVICE_TOKEN=...
   ```
   Шаблон: `.env.production.example`  
   **JWT_SECRET не меняй**, если на проде уже есть пользователи.  
   **DATABASE_URL** только `postgresql://...` — не `file:./dev.db`.
3. `npm ci` (или `npm install`)
4. `npx prisma migrate deploy` + `npx prisma generate`
5. Рестарт процесса (pm2/systemd). Nginx как раньше на `potokmessenger.ru`.

Локальный `.env` на VPS целиком не копируй: SMTP/S3 можно перенести, но `FRONTEND_URL`/`CORS_ORIGINS`/`NODE_ENV` должны быть прод.

## Release APK

Конфиг уже прод: нет `server.url`, нет `VITE_API_URL` → API `https://potokmessenger.ru`.

```bash
cd messenger-refactored
npm run build
npx cap sync android
```

Дальше Android Studio → **release** (подпись = отпечаток в RuStore Console).

Live-debug потом: в `.env.local` раскомментируй `VITE_API_URL`, в `capacitor.config.json` верни блок `server`.
