# Potok Messenger

Realtime-мессенджер: веб + Android APK (Capacitor), один Node-сервер, PostgreSQL, пуши FCM и RuStore.

**Прод:** [potokmessenger.ru](https://potokmessenger.ru)  
**Пакет Android:** `com.potokmessenger.app`  
**Слепок:** 18 августа 2026. Журнал — [`NOTES.md`](NOTES.md), деплой — [`DEPLOY.md`](DEPLOY.md).

---

## Статус (18 авг)

Веб и текущий APK после сегодняшней заливки в целом живые. Большинство багов из списков 17–18 авг закрыто в коде. Контрольный смоук — завтра (см. ниже).

На VPS после каждой заливки сервера:

```bash
npx prisma migrate deploy
npx prisma generate
# pm2 restart
```

`JWT_SECRET` не менять. `DATABASE_URL` только `postgresql://…`.  
`FRONTEND_URL` — **одна** строка `https://potokmessenger.ru` (dotenv берёт первую; дубль с localhost ломал ссылку сброса).

Миграции, которые должны быть на проде:

- `20260817180000_add_user_token_version` — `User.tokenVersion`
- `20260818220000_add_contact_hidden` — `Contact.hidden`

---

## Слепок работы 17–18 августа 2026

### Сделано (сервер)

- JWT revoke через `User.tokenVersion` (не RAM). Logout гасит старый токен навсегда.
- Сброс пароля: Unisender Go API первым, SMTP запасной. `FRONTEND_URL` с localhost/пустой игнорируется → `https://potokmessenger.ru`.
- Ник при регистрации/профиле: фильтр `badWords` (маты, транслит, leet).
- Mute: приватный upsert `PrivateChatMember`; FCM/RuStore не шлются, если чат в mute.
- Логин отдаёт `email` + `avatar`. История сообщений — `sender.avatar`.
- Свой сокет `user_{self}` больше не режется как «чат с собой».
- Кик/выход из канала: `JoinRequest` сбрасывается; повторная заявка не врёт «уже участник».
- Пуш: в data есть `chatId` / `senderId` / url `/?chat=…`. **В личке** получатель открывает `user_{отправитель}`, не «чат с собой».
- Контакты: скрытие — флаг `hidden` (одностороннее). Переписка и пуши остаются. `PATCH /api/contacts/:id/unhide`.

### Сделано (клиент / APK)

- Удаление группы/канала → главная, не «общий чат».
- Logout: сначала unregister push, потом revoke JWT (не было 403 на `DELETE /push-token`).
- Mute в UI: без звука, серый бейдж, 🔕.
- Онлайн-точка в сайдбаре; в шапке лички «в сети».
- Пагинация истории не сбрасывает скролл (спиннер только на первой загрузке).
- Тосты: ник занят / изменён, файл > 20 МБ, сессия истекла.
- Форма входа: `id` / `name` / `autocomplete` (сохранение логина в APK).
- Назад APK: модалки → чат → выход. Контекст-меню в чате, не системное iOS.
- 403 JWT → выход на логин. 403 «не участник» → закрыть чат, тост (не путать с JWT).
- Заявки в открытом профиле: сокет `join_request_received`. 403/404 не спамят.
- Возврат на вкладку: reconnect сокета + тихий рефетч чатов/контактов/истории.
- Клик по пушу открывает чат (SW + Capacitor `pushNotificationActionPerformed`). Лички починены 18 авг.
- StatusBar: светлые иконки на тёмной теме, тёмные на светлой (`@capacitor/status-bar`).
- Профиль APK: safe-area — крестик не под батареей, заявки не под системными кнопками.
- Голос: отмена ✕ без отправки, ➤ отправить, плоская 2D-иконка микрофона.
- Смайлы в инпуте. До 5 фото за раз + спиннер.
- Контакт: контекстное меню «Скрыть» / секция «Скрытые» → «Вернуть».
- Просмотр фото: зум + листание (свайп / стрелки).
- React #310 в сайдбаре (хуки до early-return).

### Не делали / отложено (следующий спринт)

Не трогать в ближайшем паке: **видео, документы, кнопки в шторке пуша** («Ответить / Прочитано / Удалить») — нативка.

| Тема | Как планируем |
|------|----------------|
| Цитата/ответ снизу | как WhatsApp |
| Комменты канала | отдельная модалка |
| Галерея | листать уже есть; реакции/комменты в галерее — если тяжело, не тащить |
| Галочки прочтения в сайдбаре | отдельная задача |
| Жалобы / мини-админка | кнопка «пожаловаться» + список владельцу, без большой админки |
| Разговорный динамик | нативный плагин |
| Блок юзера (не писать) | отдельно от «скрыть» |
| Свайп обновить | не в чате (ломает пагинацию); если нужно — только список чатов |
| ИИ-бот (Ollama) | не стартовать, пока смоук и стор |

Пул-ту-рефреш в чате **не добавляли** сознательно.

Контакт, скрытый **старым** DELETE (до миграции `hidden`), в «Скрытых» не появится — вернуть через ➕ поиск один раз.

---

## Контрольный смоук (завтра)

Короткий прогон на **проде** (веб + свежий APK). Старый APK пуш-лички / скрытие / статусбар не отражает.

1. Сброс пароля — ссылка `https://potokmessenger.ru/reset-password?…`, не localhost.
2. Logout на одном клиенте → второй (веб/APK) через время просит логин, пуш после выхода не приходит.
3. Mute: нет звука и пуша, бейдж серый, 🔕.
4. Пуш: личка / группа / канал открывают **этот** чат.
5. Кик из канала → повторная заявка (не «уже участник»); заявка видна в открытом профиле.
6. Скрыть контакт → секция «Скрытые» → Вернуть. Пуши от него всё ещё приходят.
7. Пагинация вверх в длинном чате — не прыгает вниз.
8. Профиль канала: крестик ниже статусбара, «Принять» заявку можно нажать (не под навбаром).
9. Голос: запись → ✕ не отправляет; ➤ отправляет.
10. 5 фото, зум и листание в просмотре.
11. Тёмная тема APK: видны время / заряд / Wi‑Fi.
12. Назад: модалка закрывается, не приложение.
13. Длинная сессия 10–20 мин: вкладка в фоне → вернулся — last message и история без F5. Если лаг остался — записывать, это следующий точечный баг, не новый спринт.

---

## Стек

| Слой | Что |
|------|-----|
| Клиент | React 19, Vite 8, Tailwind 4, React Router 7, Socket.io-client 4 |
| Натив | Capacitor 8, `@capacitor/app`, `@capacitor/push-notifications`, `@capacitor/status-bar`, `capacitor-voice-recorder` |
| Android | `com.potokmessenger.app`, minSdk 24, target/compile 36, Java 21 |
| RuStore SDK | `ru.rustore.sdk:pushclient:6.4.0` |
| Сервер | Node, Express 5, Socket.io 4, Prisma 5.22, JWT, Helmet, cors, rate-limit, bcryptjs |
| БД | только PostgreSQL (`pg`) |
| Файлы | Yandex Object Storage (S3), fallback `public/uploads` |
| Пуши веб | Firebase JS + `firebase-messaging-sw.js` |
| Пуши APK | FCM Capacitor + плагин `RuStorePush` |
| Пуши сервер | `firebase-admin` → FCM; HTTP → `vkpns.rustore.ru` |
| Почта | Unisender Go API, SMTP Яндекс запасной |
| Деплой | VPS Ubuntu, Nginx (TLS + WS upgrade), PM2 |

VPS маленький (1 vCPU, ~1 ГБ RAM, 10 ГБ диск, без swap) — **не** собирать Vite/Gradle на сервере. `dist` и APK — локально.

---

## Репозиторий

```
Messenger-App/
├── Server-Refactor/          # API + Socket.io + Prisma
├── messenger-refactored/     # Vite SPA + android/
├── DEPLOY.md
├── NOTES.md
└── README.md
```

Два рабочих корня. Клиент ходит на абсолютный `API_BASE_URL` (`messenger-refactored/src/config.js`). Корневой `messenger-refactored/config.js` — заглушка, не импортировать.

`.env` / `.env.local` в gitignore.  
`messenger-refactored/.env.local` — только публичные `VITE_FIREBASE_*` (они всё равно в бандле). Секреты — `Server-Refactor/.env`.

---

## Архитектура

```
[ Chrome / PWA ]                    [ Android WebView Capacitor ]
        |                                      |
        |  HTTPS + WSS                         |  origin https://localhost
        |  FCM SW                              |  native FCM + RuStore SDK
        v                                      v
              https://potokmessenger.ru
              Nginx → Node :5001
                    |
         REST /api/*  +  Socket.io /socket.io
                    |
              Prisma → PostgreSQL
                    |
         Yandex S3 | Firebase Admin | RuStore Push API | Unisender
```

Один user может быть онлайн в вебе и APK сразу (`userId → Set<socketId>`). Offline — когда отвалился **последний** сокет.

### API URL клиента

```
по умолчанию     https://potokmessenger.ru
VITE_API_URL     перебивает (.env.local, live-debug)
```

Release APK: нет `server.url`, нет `VITE_API_URL` → прод.  
`CapacitorHttp.enabled: false`. Натив: `Capacitor.isNativePlatform()`.

---

## Идентификаторы чатов

| Префикс | Смысл | Пример |
|---------|--------|--------|
| `user_{id}` | приват (у каждого свой: «чат с этим человеком») | `user_12` |
| `chat_{id}` | группа | `chat_5` |
| `channel_{id}` | канал | `channel_3` |
| `chat_general` | старое лобби | закрыт (403) |

Пуш в личке **обязан** нести `user_{senderId}` для получателя. Id отправителя (`user_{receiver}`) открывает «чат с собой» и сразу закрывается.

Хелперы: `src/utils/chatUtils.js`, сервер `src/utils/chatAccess.js`.

---

## Клиент

SPA: `App.jsx` — оркестратор. Хуки: `useAppState`, `useSocket`, `useMessages`, `useChats`, `useContacts`, `useUnread`, `useMessageHandlers`, `useMarkAsRead`, `useTheme`, `useToast`.

Компоненты: `Sidebar`, `ChatArea`, `ProfilePanel`, `Auth`, `ResetPassword`. Роуты: `/`, `/reset-password`.

Голос: веб `getUserMedia`; APK `capacitor-voice-recorder`. На HTTP live-reload микрофона браузера нет — норма.

### Capacitor / Android

- Не подменять `WebViewClient`. Origin — `https://localhost`.
- `RuStorePush` регистрировать до `super.onCreate()`.
- Подпись debug/release = отпечаток в RuStore Console.
- После смены плагинов (StatusBar и т.п.): `npm run build` → `npx cap sync android` → новый release.

---

## Сервер

`server.js` — Express + `http.Server` + Socket.io, `0.0.0.0`. Prisma: `src/lib/prisma.js`.

| Префикс | Назначение |
|---------|------------|
| `/api/auth` | register, login, logout, forgot/reset |
| `/api/users` | профиль, аватар |
| `/api/channels` | CRUD, участники, join-requests |
| `/api/chats` | группы |
| `/api/messages` | история, pin, edit, reactions, search |
| `/api/contacts` | контакты; DELETE = скрыть; `PATCH /:id/unhide` |
| `/api/upload` | медиа (лимит аватара 20 МБ) |
| `/api/read` `/api/unread` `/api/mute` | прочтение, счётчики, мут |
| `/api/push-token` | POST сохранить, DELETE деактивировать |

JWT: `Authorization: Bearer`, в payload `tokenVersion`. Middleware сравнивает с БД. Старые JWT без поля = `0`.

CORS: `CORS_ORIGINS` **плюс всегда** `https://localhost`, `http://localhost`, `capacitor://localhost`, `ionic://localhost`.

Сокеты после JWT: `join_chat`, `send_message`, `delete_message`, `read_messages`, `typing`, мемберы, треды, реакции, апдейты канала/группы.

---

## Пуши

Три канала сразу: веб FCM, APK FCM, RuStore. Один блок `notification` (не дублировать в `webpush.notification`).

Клик: `chatId` + `senderId` в data. Клиент: событие `potok-open-chat` / SW `OPEN_CHAT`.

---

## Переменные окружения

Шаблоны: `Server-Refactor/.env.example`, `.env.production.example`. **`.env` в git не класть.**

Сервер: `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` (один раз), `CORS_ORIGINS`, `UNISENDER_*`, SMTP, `S3_*`, Firebase Admin, `RUSTORE_*`.

Клиент: `VITE_API_URL` (опционально), `VITE_FIREBASE_*`, `VITE_FIREBASE_VAPID_KEY`.

---

## Сборка

```bash
cd messenger-refactored
npm run build                 # dist → Nginx
npx cap sync android          # после build, перед APK
```

Сервер: код → `.env` → `npm ci` → `npx prisma migrate deploy` → `npx prisma generate` → pm2. Nginx: Upgrade/Connection для `/socket.io`.

---

## Нюансы

1. Origin APK = `https://localhost` → CORS обязан пускать.
2. Сокет на Android: polling → websocket.
3. Не включать `CapacitorHttp`. Не ставить `hostname: potokmessenger.ru` в Capacitor.
4. `FRONTEND_URL` — первая строка в `.env` побеждает.
5. 403 на все `/api/*` сразу = мёртвый JWT. 403 только на канал = не участник.
6. `fixed` панели (профиль) игнорируют padding `App` — safe-area на самой панели.
7. `App.jsx` толстый; рефакторинг не трогали.

---

Автор: **AmigoTatar** · [GitHub](https://github.com/AmigoTatar) · [potokmessenger.ru](https://potokmessenger.ru)
