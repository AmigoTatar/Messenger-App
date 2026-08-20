# Potok Messenger

Realtime-мессенджер: веб + Android APK (Capacitor), один Node-сервер, PostgreSQL, пуши FCM и RuStore.

**Прод:** [potokmessenger.ru](https://potokmessenger.ru)  
**Пакет Android:** `com.potokmessenger.app` (`versionCode` 1 / `versionName` 1.0)  
**Слепок:** 20 августа 2026.

Журнал багов и «было → стало» — [`NOTES.md`](NOTES.md).  
Как заливать сервер и собирать APK — [`DEPLOY.md`](DEPLOY.md).

**Магазины:** заявка в [RuStore](https://www.rustore.ru/) отправлена, ждём модерацию. Galaxy Store для физлица недоступен (нужна компания) — не целимся, пока нет юрлица.

Юридические страницы (должны открываться с телефона):

- Политика: https://potokmessenger.ru/privacy-policy.html  
- Соглашение: https://potokmessenger.ru/terms.html  
- Поддержка: [mesengrpotok@gmail.com](mailto:mesengrpotok@gmail.com)

---

## Что это за проект

Два рабочих корня в одном репо:

| Папка | Роль |
|-------|------|
| `Server-Refactor/` | Express + Socket.io + Prisma + пуши + почта |
| `messenger-refactored/` | Vite SPA + `android/` (Capacitor) |

Клиент всегда ходит на абсолютный `API_BASE_URL` из `messenger-refactored/src/config.js`.  
Корневой `messenger-refactored/config.js` — заглушка, **не импортировать**.

Один аккаунт может быть онлайн в вебе и в APK сразу (`userId → набор socket.id`). Offline — когда отвалился **последний** сокет.

VPS маленький (примерно 1 vCPU, 1 ГБ RAM, 10 ГБ диск, без swap). **Vite и Gradle на сервере не собирать** — упадёт по памяти. `dist` и APK только с ПК.

---

## Статус 20 августа 2026

Веб и APK после пакетов 17–20 авг закрывают списки багов этих дней. Сборка ушла в RuStore (`versionCode` 1). Пока модерация: **не менять** `applicationId` и ключ подписи. Следующий апдейт в стор — `versionCode` 2.

Сделано в том числе:

- сессии через `User.tokenVersion` (logout гасит все устройства);
- скрытие контакта (не удаление переписки);
- цитата как в WhatsApp; комментарии канала с тумблером у админа;
- личный блок («не писать»), жалобы в БД + письмо, щит в сайдбаре у id из `ADMIN_USER_IDS`;
- мультидевайс: своё сообщение с телефона видно в сайдбаре веба;
- удаление User из Prisma Studio больше не оставляет «зомби-сокет»;
- FCM не падает на тексте > 4 КБ;
- плохая сеть: «Не удалось отправить · Повторить»;
- галочки прочтения в сайдбаре на своих последних;
- техподдержка, соглашение и политика — ссылки внизу сайдбара; жалобы в APK не прячутся под кнопками навигации.

**Не делаем сейчас (и не путать с багами):**

| Тема | Почему |
|------|--------|
| Видео, документы, кнопки в шторке пуша | Нативка / отдельный объём, тот же бакет что видео |
| Разговорный динамик у голосовых | HTML `<audio>` в WebView не умеет `STREAM_VOICE_CALL` — нужен Java-плагин |
| Админский бан аккаунта | Пока только личный блок; схема бана обсуждена (`bannedAt` + `tokenVersion`), в код не писали |
| ИИ по жалобам / бот | После релиза; жалобы уже пишутся в `Report` и на почту |
| Рефакторинг толстого `App.jsx` | Работает, не трогаем перед стором |
| Pull-to-refresh в чате | Ломает пагинацию истории |

Контакт, скрытый **старым** DELETE (до миграции `hidden`), в «Скрытых» не появится — вернуть через поиск ➕ один раз.

---

## Стек

| Слой | Что |
|------|-----|
| Клиент | React 19, Vite 8, Tailwind 4, React Router 7, Socket.io-client 4 |
| Натив | Capacitor 8, App, Push, StatusBar, `capacitor-voice-recorder` |
| Android | `com.potokmessenger.app`, minSdk 24, target/compile 36, Java 21 |
| RuStore SDK | `ru.rustore.sdk:pushclient:6.4.0` |
| Сервер | Node, Express 5, Socket.io 4, Prisma 5.22, JWT, Helmet, cors, rate-limit, bcryptjs |
| БД | только PostgreSQL (`pg`), не SQLite |
| Файлы | Yandex Object Storage (S3), fallback `public/uploads` |
| Пуши | веб FCM + SW; APK FCM Capacitor + плагин `RuStorePush`; сервер `firebase-admin` и `vkpns.rustore.ru` |
| Почта | Unisender Go API, SMTP Яндекс запасной |
| Деплой | Ubuntu VPS, Nginx (TLS + WebSocket upgrade), PM2 |

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

### URL API у клиента

```
по умолчанию     https://potokmessenger.ru
VITE_API_URL     перебивает (.env.local, только live-debug)
```

Release APK: нет `server.url` в Capacitor, нет `VITE_API_URL` → прод.  
`CapacitorHttp.enabled` должен быть **false**. Натив: `Capacitor.isNativePlatform()`.

---

## Идентификаторы чатов

| Префикс | Смысл | Пример |
|---------|--------|--------|
| `user_{id}` | личка. У каждого свой id: «чат с этим человеком» | `user_12` |
| `chat_{id}` | группа | `chat_5` |
| `channel_{id}` | канал | `channel_3` |
| `chat_general` | старое лобби | закрыт (403) |

В личке пуш **обязан** нести `user_{senderId}` для получателя. Если отдать id отправителя (`user_{receiver}`), получатель откроет «чат с собой» и чат сразу закроется.

Хелперы: клиент `src/utils/chatUtils.js`, сервер `src/utils/chatAccess.js`.

---

## Как устроены сессии (важно)

JWT живёт **30 дней**, не 15 минут. В payload есть `tokenVersion`. Middleware и handshake сокета сравнивают его с `User.tokenVersion` в БД.

- Logout → `tokenVersion++` → все устройства (веб и APK) через несколько секунд просят логин. Это не баг.
- Старый JWT без поля считается как `0`.
- **`JWT_SECRET` на проде не менять** — все сессии слетят разом.

Админка жалоб — не отдельный аккаунт. В `.env` пишется обычный `User.id`:

```
ADMIN_USER_IDS=1
REPORT_EMAIL=mesengrpotok@gmail.com
```

У этого пользователя в сайдбаре щит 🛡️. Жалоба пишется в таблицу `Report` и уходит письмом.

Личный блок ≠ бан: человек не пишет тебе в личку, но в приложение заходит. Выключить аккаунт целиком (админский бан) пока не сделано.

---

## Клиент

SPA: `App.jsx` — оркестратор. Хуки: `useAppState`, `useSocket`, `useMessages`, `useChats`, `useContacts`, `useUnread`, `useMessageHandlers`, `useMarkAsRead`, `useTheme`, `useToast`.

Экраны: `Sidebar`, `ChatArea`, `ProfilePanel`, `Auth`, `ResetPassword`. Роуты: `/`, `/reset-password`.

Голос: веб — `getUserMedia`; APK — `capacitor-voice-recorder`. На HTTP live-reload микрофона браузера нет (не secure context) — это норма.

### Capacitor / Android

- Не подменять `WebViewClient`. Origin APK — `https://localhost` (поэтому CORS обязан пускать localhost).
- `RuStorePush` регистрировать до `super.onCreate()`.
- Подпись debug/release = отпечаток в RuStore Console. Пока заявка на модерации ключ не перевыпускать.
- После смены нативных плагинов: `npm run build` → `npx cap sync android` → новый release. Hot reload JS плагин не подхватит.
- Почта в приложении: `SUPPORT_EMAIL` в `src/config.js` (сейчас `mesengrpotok@gmail.com`). Жалобы на сервере — `REPORT_EMAIL` в `.env`.

---

## Сервер

`server.js` — Express + `http.Server` + Socket.io на `0.0.0.0`. Prisma: `src/lib/prisma.js`.

| Префикс | Назначение |
|---------|------------|
| `/api/auth` | register, login, logout, forgot/reset |
| `/api/users` | профиль, аватар |
| `/api/channels` | CRUD, участники, join-requests, `commentsEnabled` |
| `/api/chats` | группы |
| `/api/messages` | история, pin, edit, reactions, search |
| `/api/contacts` | контакты; DELETE = скрыть; `PATCH /:id/unhide` |
| `/api/blocks` | личный блок |
| `/api/reports` | жалобы; `GET /status` — админ ли я; `GET /` — список |
| `/api/upload` | медиа (лимит аватара 20 МБ) |
| `/api/read` `/api/unread` `/api/mute` | прочтение, счётчики, мут |
| `/api/push-token` | POST сохранить, DELETE деактивировать |

CORS: `CORS_ORIGINS` **плюс всегда** `https://localhost`, `http://localhost`, `capacitor://localhost`, `ionic://localhost`.

Сокеты после JWT: `join_chat`, `send_message` (с ack), `delete_message`, `read_messages`, typing, мемберы, треды (комменты канала), реакции, pin, апдейты канала/группы. Если User в БД уже нет — `account_deleted` и disconnect.

---

## Пуши

Три канала сразу: веб FCM, APK FCM, RuStore. Один блок `notification` (не дублировать в `webpush.notification` — иначе Chrome рисует два баннера).

В data только короткие поля: `chatId`, `senderId`, `url`, `messageId`, `tag`. Полный текст сообщения в data не класть — лимит FCM 4 КБ.

Клик: клиент ловит `potok-open-chat` / SW `OPEN_CHAT`.

---

## Миграции, которые должны быть на проде

После `npx prisma migrate deploy`:

| Миграция | Зачем |
|----------|--------|
| `20260801071600_init_postgresql` | базовая схема |
| `20260801074511_add_join_requests` | заявки в канал |
| `20260815120000_add_push_token_platform` | FCM / RuStore |
| `20260817180000_add_user_token_version` | `User.tokenVersion` |
| `20260818220000_add_contact_hidden` | `Contact.hidden` |
| `20260819190000_replies_blocks_reports_comments` | `replyToId`, `commentsEnabled`, `UserBlock`, `Report` |

Потом обязательно `npx prisma generate` — иначе Node не увидит новые поля.

---

## Переменные окружения

Шаблоны: `Server-Refactor/.env.example`, `.env.production.example`. **`.env` в git не класть.**

Сервер: `PORT`, `NODE_ENV`, `DATABASE_URL` (только `postgresql://`), `JWT_SECRET`, `FRONTEND_URL` (**одна** строка `https://potokmessenger.ru`), `CORS_ORIGINS`, `UNISENDER_*`, SMTP, `S3_*`, Firebase Admin, `RUSTORE_*`, `ADMIN_USER_IDS`, `REPORT_EMAIL`.

Клиент: `VITE_API_URL` (опционально, только отладка), `VITE_FIREBASE_*`, `VITE_FIREBASE_VAPID_KEY`.

`FRONTEND_URL`: dotenv берёт **первую** строку. Если в `.env` два значения и сверху localhost — ссылка сброса пароля уйдёт на localhost. Пустой/localhost в коде игнорируется и подменяется на `https://potokmessenger.ru`.

---

## Сборка (локально)

```bash
cd messenger-refactored
npm run build                 # dist → Nginx
npx cap sync android          # после build, перед APK
```

Сервер на VPS: код → `.env` → `npm ci` → `npx prisma migrate deploy` → `npx prisma generate` → `pm2 restart`.  
Nginx: заголовки `Upgrade` / `Connection` для `/socket.io`.

Подробные шаги — в [`DEPLOY.md`](DEPLOY.md).

---

## Типичные ловушки (кратко)

Подробности в `NOTES.md`. Здесь — чтобы не наступить снова:

1. Origin APK = `https://localhost` → CORS без localhost = пустой экран после логина.
2. Сокет на Android: polling первым, потом websocket (чистый wss WebView часто рвёт).
3. Не включать `CapacitorHttp`. Не ставить `hostname: potokmessenger.ru` в Capacitor.
4. 403 сразу на `/api/users`, `/api/chats`, … = мёртвый JWT. 403 только на один канал = не участник, не разлогинивать.
5. «Сессия истекла» сразу после входа — гонка: старый запрос со старым JWT. Клиент игнорирует 401/403, если токен в localStorage уже новый.
6. Удаление пользователя из Prisma Studio ≠ logout: строка User пропала, сокет в RAM остался. Сервер теперь проверяет User на send/join.
7. Своё сообщение с другого устройства не было в сайдбаре, потому что рассылка `receive_message` пропускала отправителя.
8. Панели `fixed` (профиль) игнорируют padding `App` — safe-area вешать на саму панель.
9. React #310 в сайдбаре: хуки нельзя после `return`. Спиннер загрузки — после всех хуков.

---

## Смоук (прод + APK)

На **проде**, веб + **свежий** APK (старый APK не содержит цитат / блока / жалоб / фикса сайдбара).

1. Сброс пароля — ссылка `https://potokmessenger.ru/reset-password?…`, не localhost.
2. Logout на одном клиенте → второй просит логин; пуш после выхода не приходит.
3. Mute: нет звука и пуша, бейдж серый, 🔕.
4. Пуш лички / группы / канала открывает **этот** чат.
5. Кик из канала → повторная заявка (не «уже участник»).
6. Скрыть контакт → «Скрытые» → Вернуть. Пуши остаются.
7. Пагинация вверх в длинном чате не прыгает вниз. Клик по закрепу в начале истории догружает и прыгает.
8. Профиль канала: крестик ниже статусбара; тумблер комментариев у админа.
9. Голос: ✕ не отправляет, ➤ отправляет. После текста клавиатура не обязана закрываться.
10. Регистрация на телефоне: поля не прячутся под клавиатурой. Мат в нике — понятная ошибка, не «что-то пошло не так».
11. Личка с другого устройства: last message в сайдбаре. Если сеть пропала — «Повторить».
12. Удалить тестового User из Prisma Studio → в открытом приложении тост «Аккаунт удалён», писать нельзя.
13. Жалоба → письмо на `REPORT_EMAIL` и запись в 🛡️ у админа.
14. Тёмная тема APK: видны время / заряд. Назад закрывает модалку, не приложение.
15. Низ сайдбара: техподдержка / соглашение / конфиденциальность. Список жалоб не уезжает под системные кнопки.

---

Автор: **AmigoTatar** · [GitHub](https://github.com/AmigoTatar) · [potokmessenger.ru](https://potokmessenger.ru)
