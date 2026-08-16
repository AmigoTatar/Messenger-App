# Potok Messenger

Realtime-мессенджер: веб + Android APK (Capacitor), один Node-сервер, PostgreSQL, пуши FCM и RuStore.

**Прод:** [potokmessenger.ru](https://potokmessenger.ru)  
**Пакет Android:** `com.potokmessenger.app`  
**Слепок:** 15 августа 2026. Журнал правок — [`NOTES.md`](NOTES.md), деплой — [`DEPLOY.md`](DEPLOY.md).

---

## Статус

Работает: веб, release APK, сокеты, медиа (S3), голосовые, FCM, каркас RuStore Push, join-requests каналов.

На проде после заливки этого кода обязательно: `npx prisma migrate deploy`, `npx prisma generate`, рестарт процесса. `DATABASE_URL` только `postgresql://…`.

Известный долг — в конце файла.

---

## Стек (как в репо)

| Слой | Что |
|------|-----|
| Клиент | React 19, Vite 8, Tailwind 4 (`@tailwindcss/vite`), React Router 7, Socket.io-client 4 |
| Натив | Capacitor 8, `@capacitor/app`, `@capacitor/push-notifications`, `capacitor-voice-recorder` |
| Android | `namespace` / `applicationId` `com.potokmessenger.app`, minSdk 24, target/compile 36, Java 21 |
| RuStore SDK | `ru.rustore.sdk:pushclient:6.4.0` (Maven VK) |
| Сервер | Node, Express 5, Socket.io 4, Prisma 5.22, JWT, Helmet, cors, express-rate-limit, bcryptjs, Nodemailer |
| БД | **только PostgreSQL** (`pg`). SQLite больше не используем |
| Файлы | Yandex Object Storage (S3 API, `@aws-sdk/client-s3`), fallback `public/uploads` |
| Пуши веб | Firebase JS SDK + `firebase-messaging-sw.js` |
| Пуши APK | FCM через Capacitor Push + свой плагин `RuStorePush` |
| Пуши сервер | `firebase-admin` → FCM; HTTP → `https://vkpns.rustore.ru/.../messages:send` |
| Почта | SMTP Яндекс (Unisender — план) |
| Деплой | VPS Ubuntu, Nginx (TLS + WebSocket upgrade), PM2/systemd |

Консоль: `drop: ['console','debugger']` в prod-сборке Vite. В `vite.config.js` рядом стоят esbuild и oxc — **oxc побеждает**, `drop` из esbuild может не сработать; в DevTools на проде логи иногда остаются.

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

Два рабочих корня. Фронт **не** ходит на бэк относительными `/api` — всегда абсолютный `API_BASE_URL`.

Единственный конфиг клиента: `messenger-refactored/src/config.js`.  
Корневой `messenger-refactored/config.js` — заглушка, **не импортировать**.

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
         Yandex S3 | Firebase Admin | RuStore Push API
```

Клиенты независимы: один user может быть онлайн в вебе и в APK сразу (`onlineUsers`: `userId → Set<socketId>`). Offline только когда отвалился **последний** сокет.

### Как клиент выбирает API

```
по умолчанию     https://potokmessenger.ru
VITE_API_URL     перебивает (live-debug, .env.local)
```

Release APK: **нет** `server.url` в `capacitor.config.json`, **нет** `VITE_API_URL` → API прод.

Live-debug APK:

- `.env.local` → `VITE_API_URL=http://<LAN-IP>:5001`
- `capacitor.config.json` → `server.url: http://<LAN-IP>:5173`, `cleartext: true`
- Vite `server.host: true`
- `CapacitorHttp.enabled: false` — иначе fetch улетает не туда
- `android:usesCleartextTraffic="true"`

Натив: `Capacitor.isNativePlatform()`, не `window.Capacitor`.

---

## Идентификаторы чатов (критично)

Строковые id на всём пути сокет/REST:

| Префикс | Смысл | Пример |
|---------|--------|--------|
| `user_{id}` | приват с пользователем | `user_12` |
| `chat_{id}` | группа | `chat_5` |
| `channel_{id}` | канал | `channel_3` |
| `chat_general` | старое лобби | **закрыт** (`assertChatAccess` → 403) |

Хелперы: `src/utils/chatUtils.js`, сервер `src/utils/chatAccess.js`.  
`join_chat` без членства не пускает. `markRead` сам membership не создаёт.

---

## Клиент (`messenger-refactored`)

SPA в одном `App.jsx` (~840 строк) — оркестратор. Хуки:

| Хук | Роль |
|-----|------|
| `useAppState` | user, activeChat, версии списков, рефы |
| `useSocket` | connect, rooms, emit; polling → websocket |
| `useMessages` / `useChats` / `useContacts` / `useUnread` | данные |
| `useMessageHandlers` | send/delete/pin/logout/реакции/треды |
| `useAppHandlers` | часть UI-хендлеров (есть дубли logout — живой путь из `App` через `useMessageHandlers`) |
| `useMarkAsRead` | debounce прочтения |
| `useTheme` / `useToast` | тема, тосты |

Компоненты: `Sidebar`, `ChatArea`, `ProfilePanel`, `Auth`, `ResetPassword`.  
Роуты: `/`, `/reset-password`.

Навигация APK: `@capacitor/app` `backButton` + своя история экранов (чат → сайдбар, не выход из приложения).

Голос: веб — `getUserMedia`; APK — `capacitor-voice-recorder` (`RECORD_AUDIO`). На HTTP live-reload `mediaDevices` нет — это норма, нужен native плагин.

HTML вместо JSON: запрос попал на Vite `:5173`, не на API `:5001`. `apiClient` это ловит.

### Capacitor / Android — грабли

- **Не** подменять `WebViewClient` у Capacitor. Origin приложения — `https://localhost`; Capacitor сам отдаёт `dist`. Свой клиент → браузер лезет на настоящий localhost.
- `BuildConfig` в release: `buildFeatures { buildConfig true }` на уровне `android {}`, не внутри `aaptOptions`. WebView debug — через `FLAG_DEBUGGABLE`.
- Плагин `RuStorePush` регистрировать **до** `super.onCreate()`.
- `PluginCall.reject` только `(String)` / `(String, Exception)`, не `Throwable`.
- Подпись debug/release должна совпасть с отпечатком в RuStore Console, иначе пуши RuStore молчат.

---

## Сервер (`Server-Refactor`)

Точка входа: `server.js` — Express + `http.Server` + Socket.io, listen `0.0.0.0`.  
Prisma: один клиент `src/lib/prisma.js`.

### REST (основные)

| Префикс | Назначение |
|---------|------------|
| `/api/auth` | register, login, logout, forgot/reset password |
| `/api/users` | профиль, аватар, поиск |
| `/api/channels` | CRUD, участники, join-requests |
| `/api/chats` | группы |
| `/api/messages` | история, pin, edit, reactions, search |
| `/api/contacts` | взаимные контакты |
| `/api/upload` | медиа |
| `/api/read` `/api/unread` `/api/mute` | прочтение, счётчики, мут |
| `/api/push-token` | POST сохранить, DELETE деактивировать |

JWT: `Authorization: Bearer`. Logout: in-memory blacklist (`tokenRevoke.js`) + гашение веб-пуш токенов. Blacklist **живёт в RAM** — рестарт сервера оживляет JWT до `exp`.

CORS: `CORS_ORIGINS` из env **плюс всегда** Capacitor-origin’ы `https://localhost`, `http://localhost`, `capacitor://localhost`, `ionic://localhost`. Иначе APK (origin `https://localhost`) режется, сокет падает с `ERR_CONNECTION_ABORTED`.

Лимиты: global `/api`, login, register, search, reactions, read.

Сокеты (после JWT в `handshake.auth.token`):  
`join_chat`, `send_message`, `delete_message`, `read_messages`, `typing` / `stop_typing`, `add_member` / `remove_member`, `delete_channel` / `delete_group`, `create_thread`, `toggle_reaction`, `channel_updated` / `chat_updated` (только creator/admin).  
Create/delete чатов emit **участникам**, не `io.emit` всему серверу.

Доступ: `assertChatAccess` на сокете и на чувствительных REST.

---

## База

`provider = "postgresql"`. Миграции в `Server-Refactor/prisma/migrations/`, lock — postgresql.

Модели: `User`, `PasswordReset`, `PushToken`, `Contact`, `Message`, `Channel`, `ChannelMember`, `Chat`, `ChatMember`, `PrivateChatMember`, `Thread`, `Reaction`, `JoinRequest`.

`PushToken.platform`: `fcm` (Android FCM), `web` (браузер FCM), `rustore`.  
`isActive` — мягкое отключение при logout.

На VPS: `npx prisma migrate deploy` + `npx prisma generate`. Не копировать с ПК `file:./dev.db`.

---

## Файлы / S3

Бакет Yandex, `forcePathStyle: true`, **без ACL** (ACL на Yandex часто выключены, публичность — политика бакета).  
Whitelist MIME/расширений, имя файла санитизируется. Нет ключей → пишем в `public/uploads`.  
Аватары тоже через этот пайплайн (не «только локально», как было в старом README).

---

## Пуши

Три канала на одного пользователя возможны сразу: веб FCM, APK FCM, RuStore.

| Клиент | Регистрация | Logout |
|--------|-------------|--------|
| Браузер | `requestFCMToken` → POST `platform: web` | `deleteToken` + unregister SW `firebase-messaging-sw.js` + DELETE `allWeb` |
| APK | Capacitor Push (FCM) + `RuStorePush.getToken()` | unregister FCM / `deleteToken` RuStore, **веб-токены не трогаем** |

Сервер шлёт во все `isActive` токены. FCM: один блок `notification` (не дублировать в `webpush.notification` — Chrome рисует два баннера). Невалидный токен удаляется из БД.

RuStore: project id в `strings.xml` (`rustore_project_id`) и `RUSTORE_PROJECT_ID` / `RUSTORE_SERVICE_TOKEN` на сервере. S2S-токен из **RuStore Console → Push → Projects**, не VK Cloud. На устройстве без RuStore `checkAvailability=false` — норма, остаётся FCM.

Нюанс старых сессий: логаут до фикса оставлял SW в Chrome. Новые пользователи после этого фронта: вышел из веба → пуш на ПК не должен идти. Уже залогиненный старый Chrome: открыть сайт на экране логина (Ctrl+Shift+R) или Unregister SW.

---

## Фичи продукта

- Регистрация / логин / сброс пароля по email  
- Приват, группы, каналы (пишут админ/создатель)  
- Текст, фото, аудио/голос, форвард, edit, delete, pin, реакции, треды  
- Заявки в канал (повтор с таймером; manage = creator **или** admin)  
- Взаимные контакты, поиск людей и каналов  
- Мут, unread, typing, звук, тёмная тема  
- Мобильная вёрстка + APK с системной кнопкой «назад»

---

## Переменные окружения

Шаблоны: `Server-Refactor/.env.example`, `.env.production.example`. **`.env` в git не класть.**

Сервер: `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `CORS_ORIGINS`, SMTP, `S3_*`, `GOOGLE_APPLICATION_CREDENTIALS` или `FIREBASE_SERVICE_ACCOUNT_JSON`, `RUSTORE_PROJECT_ID`, `RUSTORE_SERVICE_TOKEN`.

Клиент: `VITE_API_URL` (опционально), `VITE_FIREBASE_*`, `VITE_FIREBASE_VAPID_KEY`.

`JWT_SECRET` на проде не менять — слетят сессии.

---

## Сборка

**Веб / то, что отдаёт Nginx из `dist`:**

```bash
cd messenger-refactored
npm run build
```

**Release APK:**

```bash
cd messenger-refactored
npm run build
npx cap sync android
```

Android Studio → release. Подпись = отпечаток в RuStore.

**Сервер на VPS:** код → поправить `.env` → `npm ci` → `npx prisma migrate deploy` → `npx prisma generate` → рестарт. Nginx: `proxy_set_header Upgrade` / `Connection` для `/socket.io`.

---

## Нюансы (шпаргалка)

1. Origin APK = `https://localhost` → CORS должен пускать, иначе сокет мёртв.  
2. Сокет: на Android сначала **polling**, потом upgrade; nginx WS уже работает.  
3. Не включать `CapacitorHttp` в текущей схеме.  
4. Не ставить `hostname: potokmessenger.ru` в Capacitor — перехватит `/api` как локальные файлы.  
5. `chat_general` закрыт.  
6. JWT blacklist не переживает рестарт.  
7. Аватарки/медиа без S3 ACL.  
8. Два баннера FCM = дубль `notification` или два токена в БД.  
9. Голос на live HTTP APK без native-плагина не пишется.  
10. `App.jsx` толстый; план: `useSocketBindings` → не трогали.  
11. `useMemo(profileActiveChat)` **после** `activeMessages` (иначе TDZ).  
12. 403 на join-requests у обычного мембера — норма.

---

## Долг

- **Блокер RuStore:** JWT revoke не в RAM (`tokenVersion` в User или Redis) — вместе с багами APK, до магазина  
- Рефакторинг `App.jsx`  
- Добить деплой свежего сервера+фронта на VPS (CORS, postgres, пуш-logout)  
- ИИ-бот: Ollama + gemma2:2b, FastAPI, RAG — интеграция в Node позже (см. `NOTES.md`)  
- SMTP на домен (Unisender)  
- Старые `PushToken.platform=fcm` с веба в БД — гасятся `deleteToken` при визите логина  

---

Автор: **AmigoTatar** · [GitHub](https://github.com/AmigoTatar) · [potokmessenger.ru](https://potokmessenger.ru)
