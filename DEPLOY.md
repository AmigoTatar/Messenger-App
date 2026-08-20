# Деплой: VPS + release APK

VPS слабый — **не** гонять на нём `npm run build`, Vite, Gradle, Android Studio. Иначе не хватит RAM.

Клиент (`dist`, APK) собирается на ПК. На сервер уезжает только `Server-Refactor` (+ при необходимости уже собранный `dist` для Nginx).

Шаблоны env: `Server-Refactor/.env.example`, `Server-Refactor/.env.production.example`.  
Живой `.env` в git не класть.

---

## 1. Сервер на VPS (`Server-Refactor`)

### Перед заливкой

- Не копируй локальный `.env` целиком на прод: там часто `FRONTEND_URL=http://localhost:5173`.
- **`JWT_SECRET` не меняй**, если на проде уже есть пользователи — все сессии сразу умрут.
- `DATABASE_URL` только `postgresql://…`. SQLite (`file:./dev.db`) на проде не используем.

### `.env` на проде — проверить/добавить

```
NODE_ENV=production
PORT=5001
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/messenger_db?schema=public"
JWT_SECRET=          # тот же, что уже стоит

FRONTEND_URL=https://potokmessenger.ru
CORS_ORIGINS=https://potokmessenger.ru,https://www.potokmessenger.ru,https://localhost,http://localhost,capacitor://localhost

UNISENDER_API_KEY=
UNISENDER_FROM_EMAIL=
UNISENDER_FROM_NAME=Potok
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=

ADMIN_USER_IDS=      # свой User.id из таблицы User, через запятую если несколько
REPORT_EMAIL=mesengrpotok@gmail.com

S3_ENDPOINT=https://storage.yandexcloud.net
S3_REGION=ru-central1
S3_BUCKET=potokmessenger
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_PUBLIC_URL=https://storage.yandexcloud.net/potokmessenger

GOOGLE_APPLICATION_CREDENTIALS=./potok-messenger-firebase-adminsdk.json
# или FIREBASE_SERVICE_ACCOUNT_JSON={...}

RUSTORE_PROJECT_ID=  # тот же, что в android/.../strings.xml
RUSTORE_SERVICE_TOKEN=
```

`FRONTEND_URL` — **одна** строка. Вторая с localhost сверху ломает ссылку сброса пароля (dotenv берёт первую).

`ADMIN_USER_IDS` — не отдельный админский логин, а id твоего обычного аккаунта. После рестарта в сайдбаре появится щит жалоб.

### Команды на VPS

```bash
cd /path/to/Server-Refactor
git pull          # или скопируй файлы как обычно

npm ci            # или npm install
npx prisma migrate deploy
npx prisma generate
pm2 restart messenger   # имя процесса как у тебя в pm2 list
```

`migrate deploy` применяет SQL. `generate` обновляет Prisma Client. Без generate Node не видит новые поля (`replyToId`, `commentsEnabled`, `UserBlock`, `Report`, `tokenVersion`, `hidden`) и начнёт сыпать ошибки.

Миграции, которые обязаны быть в `prisma migrate status`:

- `20260801071600_init_postgresql`
- `20260801074511_add_join_requests`
- `20260815120000_add_push_token_platform`
- `20260817180000_add_user_token_version`
- `20260818220000_add_contact_hidden`
- `20260819190000_replies_blocks_reports_comments`

Firebase JSON и RuStore-секреты должны лежать **на сервере**, не только на ноутбуке.

### Nginx

Сайт и API на `potokmessenger.ru`. Для Socket.io обязателен upgrade:

```
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
```

Без этого веб «логинится», а сообщения не приходят в реальном времени.

После рестарта: `pm2 logs messenger --lines 80` — нет падений Prisma «Unknown arg `replyToId`» / «table Report does not exist».

---

## 2. Статика веба (`dist`)

На ПК, **не** на VPS:

```bash
cd messenger-refactored
# .env.local: VITE_API_URL не задан (или закомментирован) → https://potokmessenger.ru
npm run build
```

Папку `dist/` залей туда, откуда Nginx отдаёт фронт (как у тебя уже настроено).

После сборки в бандле не должно быть `localhost:5001` / `192.168.` — иначе APK/веб с прода будут стучаться на твой ПК.

---

## 3. Release APK

Конфиг уже прод: в `capacitor.config.json` **нет** блока `server.url`, в `.env.local` **нет** `VITE_API_URL`.

```bash
cd messenger-refactored
npm run build
npx cap sync android
```

Дальше Android Studio → Build → Generate Signed Bundle / APK → **release**.

- Подпись = отпечаток в RuStore Console (debug и release путать нельзя). Пока заявка на модерации ключ не перевыпускать.
- Первая выкладка: `versionCode 1` / `versionName 1.0` в `android/app/build.gradle`. Любой апдейт в стор — поднять `versionCode`.
- После смены Java-плагинов (StatusBar, RuStore, VoiceRecorder) без `cap sync` + новой сборки APK старая нативка останется.
- Origin WebView = `https://localhost`. CORS на сервере это уже учитывает. Не ставь `hostname: potokmessenger.ru` в Capacitor.

Live-debug на LAN (не для стора): временно `VITE_API_URL` и блок `server` в Capacitor — см. `NOTES.md` → Live-debug APK. Перед стором оба вернуть как было.

---

## 4. Что проверить сразу после выката

1. Логин веба и APK. Нет тоста «Сессия истекла» в первую секунду.
2. Сообщения идут без F5. Сайдбар обновляется, в том числе свои тексты с другого устройства.
3. Сброс пароля: письмо, ссылка на `https://potokmessenger.ru/reset-password?…`.
4. Жалоба: строка в БД / щит у админа / письмо на `REPORT_EMAIL`.
5. Пуш лички открывает чат с отправителем, не «чат с собой».
6. В логах pm2 нет `Message is too large` на обычных текстах и нет спама `Сокет … в комнате`.

Полный смоук — в README, раздел «Смоук (прод + APK)».

---

## Если что-то пошло не так

| Симптом | Куда смотреть |
|---------|----------------|
| Всех выкинуло с логина | Случайно сменили `JWT_SECRET` |
| Prisma «Unknown field» | Забыли `prisma generate` после migrate |
| `table "Report" does not exist` | Не прошла миграция `20260819190000_…` |
| Сброс пароля на localhost | `FRONTEND_URL` в `.env` |
| Пустой экран в APK после логина | CORS / origin `https://localhost` |
| Нет realtime | Nginx WebSocket upgrade |
| Щита жалоб нет | `ADMIN_USER_IDS` не тот id, нет `pm2 restart` |
| Письма жалоб нет | `REPORT_EMAIL` / Unisender / SMTP; жалоба в БД всё равно должна быть |

Откат кода: верни предыдущие файлы сервера и `pm2 restart`. Миграции Prisma **назад сами не откатываются** — новые таблицы (`UserBlock`, `Report`) безопасно оставить, они не мешают старому клиенту.
