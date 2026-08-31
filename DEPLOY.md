# Деплой: VPS + APK с сайта

VPS слабый — **не** гонять на нём `npm run build`, Vite, Gradle, Android Studio. Иначе не хватит RAM.

Клиент (`dist`, APK) собирается на ПК. На сервер уезжает `Server-Refactor` и уже собранный `dist` для Nginx. Магазины не используем: APK кладётся на сайт как `/potok.apk`.

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
WELCOME_CHANNEL_ID=  # Channel.id канала-инструкции. Канал и посты — руками, потом restart

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
AI_ENABLED=false            # не true на этом VPS; Ollama сюда не ставить

```

`FRONTEND_URL` — **одна** строка. Вторая с localhost сверху ломает ссылку сброса пароля (dotenv берёт первую).

`ADMIN_USER_IDS` — не отдельный админский логин, а id твоего обычного аккаунта. После рестарта в сайдбаре появится щит жалоб.

`WELCOME_CHANNEL_ID` — id канала из таблицы `Channel`. Без переменной регистрация работает как раньше. Уже существующие пользователи сами не подпишутся.

`AI_ENABLED=false` — заготовка под бота. На этом VPS **не** ставить Ollama и **не** ставить `true`. Когда будет отдельный сервис (`potok-ai-bot`): `AI_USER_ID` (аккаунт-бот в таблице User), `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, затем флаг. Пока выключено — `GET /api/ai/status` отвечает `{ enabled: false }`, личка к боту не проксируется.

Когда будешь заливать сервер на VPS:

1. Своим аккаунтом создай канал (например «Potok») и напиши посты-инструкции.
2. Узнай id: Prisma Studio / SQL `SELECT id, name FROM "Channel";`
3. В `.env` на VPS добавь `WELCOME_CHANNEL_ID=этот_id` (рядом с `ADMIN_USER_IDS`).
4. `pm2 restart` процесса сервера. Миграции для этого шага не нужны.
5. Проверка: зарегистрируй тестовый аккаунт — канал должен сразу быть в сайдбаре.

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

SPA-роуты (`/`, `/reset-password`, `/ai`):

```
location / {
    try_files $uri $uri/ /index.html;
}
```

APK (после `npm run build` файл **не** попадает в `dist` сам — копируй отдельно):

```
location = /potok.apk {
    default_type application/vnd.android.package-archive;
    add_header Content-Disposition "attachment; filename=potok.apk";
}
```

Без WebSocket-upgrade веб «логинится», а сообщения не приходят в реальном времени.

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

APK для кнопки «Скачать приложение» на вебе: положи подписанный файл как **`/potok.apk`** рядом с `index.html` (тот же корень Nginx). Кнопка видна только в браузере, в APK её нет.

После сборки в бандле не должно быть `localhost:5001` / `192.168.` — иначе APK/веб с прода будут стучаться на твой ПК.

---

## 3. Release APK (сайт, не стор)

Конфиг уже прод: в `capacitor.config.json` **нет** блока `server.url`, в `.env.local` **нет** `VITE_API_URL`.

```bash
cd messenger-refactored
npm run build
npx cap sync android
```

Дальше Android Studio → Build → Generate Signed Bundle / APK → **release**. Готовый файл положи на Nginx как `/potok.apk` (кнопка на вебе качает именно его).

- Подпись debug и release не путать. Ключ релиза не перевыпускать — уже стоящие APK не обновятся.
- Сейчас в gradle: `versionCode 1` / `versionName 1.0`. Эта сборка (шаринг фото, Filesystem) — подними `versionCode` (например 2), иначе Android может отказаться обновлять.
- После смены Java-плагинов (StatusBar, RuStore Push, VoiceRecorder, Share, Filesystem) без `cap sync` + новой сборки APK старая нативка останется.
- Origin WebView = `https://localhost`. CORS на сервере это уже учитывает. Не ставь `hostname: potokmessenger.ru` в Capacitor.

Live-debug на LAN (не для публичного APK): временно `VITE_API_URL` и блок `server` в Capacitor — см. `NOTES.md` → Live-debug APK. Перед выкладкой оба вернуть как было.

---

## 4. Что проверить сразу после выката

1. Логин веба и APK. Нет тоста «Сессия истекла» в первую секунду.
2. Сообщения идут без F5. Сайдбар обновляется, в том числе свои тексты с другого устройства.
3. Сброс пароля: письмо, ссылка на `https://potokmessenger.ru/reset-password?…`.
4. Жалоба: строка в БД / щит у админа / письмо на `REPORT_EMAIL`.
5. Пуш лички открывает чат с отправителем, не «чат с собой».
6. В логах pm2 нет `Message is too large` на обычных текстах и нет спама `Сокет … в комнате`.
7. Веб: кнопка «Скачать приложение», файл `/potok.apk` отдаётся. В APK кнопки нет.
8. `/ai` открывается (не 404 Nginx). `GET /api/ai/status` → `enabled: false`.
9. Новый тестовый аккаунт видит welcome-канал, если `WELCOME_CHANNEL_ID` задан.

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
| `/ai` или `/reset-password` — 404 | Nginx без `try_files` на `index.html` |
| «Скачать приложение» 404 | Нет файла `/potok.apk` в корне сайта |
| Новый юзер без канала-инструкции | Пустой или неверный `WELCOME_CHANNEL_ID`, нет `pm2 restart` |

Откат кода: верни предыдущие файлы сервера и `pm2 restart`. Миграции Prisma **назад сами не откатываются** — новые таблицы (`UserBlock`, `Report`) безопасно оставить, они не мешают старому клиенту.
