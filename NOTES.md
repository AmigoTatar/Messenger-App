# NOTES

Журнал: что ломалось, почему, как починили.

Актуальный статус продукта, стек и смоук — [`README.md`](README.md).  
Деплой — [`DEPLOY.md`](DEPLOY.md).

---

## Слепок 1 сен 2026

**Прод:** сайт отдаёт APK `versionCode` 3 / `1.0.2`. Nginx root — `~/messenger/messenger-refactored/dist/` (`index.html`, `version.json`, `potok.apk` рядом). ИИ / Ollama на VPS нет.

| | Код | Прод |
|---|-----|------|
| Поиск → скролл к сообщению | готово | фронт заливали |
| Вкладки Чаты / Группы / Каналы + зелёный unread | готово | фронт заливали |
| Пустой список не поднимает вкладки | готово | в том же `dist` |
| Тулбар превью фото ниже шторки | готово | да |
| «Поделиться» фото (файл, не ссылка) | готово | нужен APK с Share/Filesystem |
| «Скачать» → галерея `Pictures/Potok` (`SaveToGallery`) | готово | APK залит в `dist`, на телефон ещё не ставили |
| «Скачать приложение» на вебе | готово | `/potok.apk` |
| «Обновить приложение» в APK | код есть (`UpdateAppButton`) | **не включено**: сайт и телефон оба код 3 |
| Welcome-канал после register | код есть | нужен `WELCOME_CHANNEL_ID` + `pm2 restart` |

Локально уже размечено `4` / `1.0.3` (gradle, `APK_DOWNLOAD`, `public/version.json`) — на VPS `version.json` оставляем **3**, пока не будем включать кнопку обновления.

Когда включать: поднять сайт и подписанный APK **одним** числом (4), файл только в `dist/potok.apk`. Кнопка видна, если `remote.versionCode >` установленного. Веб кнопку не показывает. Старый APK без `UpdateAppButton` сам её не получит — один раз поставить сборку с кнопкой с сайта.

---

## Пакет 31 авг 2026 (после сторов)

RuStore отклонил (реестр РКН). Магазины не целимся — APK с сайта (`/potok.apk`). Код шагов 0–5 и кнопка скачивания на вебе **сделаны**. Публичная APK: `versionCode` 3 / `1.0.2`.

| # | Что | Статус |
|---|-----|--------|
| 0 | UX / логи / safe-area | Сделано 31 авг |
| 1 | Welcome-канал после register (`WELCOME_CHANNEL_ID`) | Код готов. На проде: канал руками, id в env, `pm2 restart` |
| 2 | «Поделиться» фото | Сделано. В APK после `cap sync` + новой сборки |
| 3 | «Скачать» фото | Сделано. То же |
| 4 | Заглушка `/ai` | Сделано. Бота нет |
| 5 | Бэкенд `AI_ENABLED=false` | Сделано. Ollama на VPS нет |
| — | Кнопка «Скачать приложение» на вебе | Сделано 31 авг. Файл `/potok.apk` на Nginx |

**Дальше не в этом пакете:** VK ID, превью ссылок/файлов, админский бан, разговорный динамик, видео, живой ИИ.

---

## 1 сен 2026 — поиск, вкладки, галерея

| | |
|---|---|
| **Поиск** | Клик по хиту звал `selectChat(chatId)` без `messageId` — открывался только чат. Стало `selectChat(chatId, null, messageId)` → `ChatArea.jumpToMessage` (тот же цикл load-more, что у закрепов). Переключает вкладку сайдбара |
| **Сайдбар** | Три вкладки **над** «Potok» + тема. Unread → зелёное свечение. Пустой список сжимал колонку — вкладки уезжали вверх. Фикс: `h-full min-h-0`, футер `shrink-0`, заглушки «Пока нет чатов/групп/каналов». `ChannelList` / `GroupList`: `hideTitle` |
| **Скачать фото** | WebView `fetch(S3)` — CORS. Потом `Filesystem.downloadFile` без mkdir. Потом ошибочно тот же шит, что «Поделиться». Стало: кэш + плагин `SaveToGallery` → MediaStore `Pictures/Potok`, тост «Фото сохранено». Java: `android/.../SaveToGalleryPlugin.java`, регистрация в `MainActivity` рядом с `RuStorePush`. JS: `src/services/saveToGallery.js` |
| **Обновить APK** | `UpdateAppButton`: только натив, `GET /version.json` (`cache: no-store`), кнопка если `remote.versionCode > App.getInfo().build`, открывает `/potok.apk`. Пока не выкатываем |
| **Welcome** | `subscribeToWelcomeChannel` после register. На проде: `WELCOME_CHANNEL_ID` + `pm2 restart`. Старые аккаунты сами не подписываются |

---

## 31 авг 2026 — превью фото: шторка и «не удалось сохранить»

| | |
|---|---|
| **Было** | Кнопки «Скачать» / «Поделиться» — `absolute top-0`. Сохранение: `Filesystem.downloadFile` в `Potok/` и `share/` без mkdir (нативка `recursive` игнорирует) → оба пути падали, шита не было, тост «Не удалось сохранить фото» |
| **Стало (31 авг)** | Тулбар ниже шторки. Скачивание через Filesystem + шит «Сохранить фото». Запасной кач через `CapacitorHttp.get` без глобального CapacitorHttp |
| **Потом (1 сен)** | Шит у «Скачать» убрали: MediaStore через `SaveToGallery`. «Поделиться» по-прежнему системный шит с файлом |
| **Где** | `MessageList.jsx`, `shareImage.js`, `saveToGallery.js`, `SaveToGalleryPlugin.java`, `file_paths.xml` |
| **APK** | Нужна сборка с плагином |

---

## 31 авг 2026

Кнопка «Скачать приложение» только в вебе.

| | |
|---|---|
| **Было** | APK негде было взять с сайта |
| **Стало** | `DownloadAppButton` на Auth и в футере сайдбара. APK скрывает кнопку (`isNativeApp`). Ссылка `/potok.apk` |
| **Где** | `DownloadAppButton.jsx`, `Auth.jsx`, `Sidebar.jsx`, `config.js` → `APK_DOWNLOAD` |
| **Прод** | Положить подписанный файл в корень Nginx |

Шаг 5: заготовка бэкенда ИИ.

| | |
|---|---|
| **Было** | Не было `/api/ai` |
| **Стало** | `GET /api/ai/status` → `{ enabled: false }`. `POST /api/ai/complete` при выключенном флаге 503. В `send_message` хук `maybeReplyToUser` — сразу выход, пока нет `AI_ENABLED=true` + `AI_USER_ID` + токен. Процесс не ходит в Ollama |
| **Где** | `aiConfig.js`, `aiAssistant.js`, `aiRoutes.js`, `socketHandlers.js` |
| **Потом** | Отдельная машина/контейнер с `potok-ai-bot`, env как в DEPLOY |

Шаг 4: заглушка Potok AI.

| | |
|---|---|
| **Было** | В сайдбаре не было пункта про ИИ |
| **Стало** | Строка «Potok AI (скоро)» → `/ai`. Текст: скоро в 1.2. Запросов к модели нет. Системная «Назад» в APK возвращает в чаты |
| **Где** | `AiAssistant.jsx`, `main.jsx`, `Sidebar.jsx` |

Шаг 3: сохранить фото из полноэкранного просмотра.

| | |
|---|---|
| **Было** | Только «Поделиться» |
| **Стало** | Кнопка «Скачать»: веб — файл в загрузки браузера. APK — `Documents/Potok`, плагин сам прогоняет MediaScanner. Если нет прав — системный шаринг (сохранить в галерею) |
| **Где** | `shareImage.js` (`saveImage`), `MessageList.jsx`, `AndroidManifest.xml` |

Шаг 2: «Поделиться» из полноэкранного фото.

| | |
|---|---|
| **Было** | Превью только зум/свайп |
| **Стало** | Кнопка «Поделиться»: веб — файл через `navigator.share`, иначе ссылка. APK — файл в Cache + `@capacitor/share`, если fetch не вышел — ссылка |
| **Где** | `shareImage.js`, `MessageList.jsx` |
| **APK** | `@capacitor/share` + `@capacitor/filesystem`, `npx cap sync android` |

Шаг 1: после регистрации — member на канал-инструкцию.

| | |
|---|---|
| **Было** | `register` создавал User и сразу JWT, канала не было |
| **Стало** | Если в env есть `WELCOME_CHANNEL_ID` и канал существует — `channelMember` role=member. Сбой подписки не валит регистрацию. Старые аккаунты не трогаем |
| **Где** | `welcomeChannel.js`, `authController.js` |
| **Прод** | Создать канал руками, посты, вписать id, `pm2 restart` |

Шаг 0 пакета после сторов: проход по логам и safe-area, без новых фич.

### Логи и токены

| | |
|---|---|
| **Было** | Сброс пароля при сбое почты писал сырой токен в лог. Клиент логировал каждое сообщение / typing / joinChat / unread. Поиск каналов нумеровал шаги. `searchChannels` отдавал `stack` клиенту |
| **Стало** | Токен не логируется. Hot-path `console.log` снят, `warn`/`error` остались. Оверлеи модалок — класс `.sheet-safe`, тост выше выреза |
| **Где** | `passwordController.js`, хуки чата, модалки, `index.css`, `Toast.jsx`, `socketHandlers.js`, `channelController.js` |

---

## 19 авг 2026

Пакет багов + то, что осталось с 17–18 (цитата, комменты канала, блок, жалобы, галочки сайдбара). Разговорный динамик и админский бан аккаунта **не** делали — см. README.

### Удалённый User продолжает писать через сокет

| | |
|---|---|
| **Было** | JWT проверили при connect, User ещё был. Prisma Studio `DELETE FROM "User"` — сокет в RAM, «онлайн», `send_message` проходит |
| **Стало** | На `join_chat` / `send_message` / `create_thread` повторная проверка строки User. Нет → `account_deleted` + `disconnect(true)`. Клиент чистит сессию и тост «Аккаунт удалён» |
| **Где** | `socketHandlers.js`, `App.jsx` |
| **Нюанс** | Это не про JWT. Токен ещё валидный, человека в БД уже нет. Физический DELETE лучше не использовать на проде — мягкий бан (`bannedAt`) ещё не сделан |

### Клавиатура на регистрации (Android)

| | |
|---|---|
| **Было** | Форма по центру экрана, клавиатура закрывала поля, Enter прыгал дальше |
| **Стало** | Скролл `100dvh`, логотип меньше на регистрации, `scrollIntoView` на фокусе |
| **Где** | `Auth.jsx` |

### «Сессия истекла» сразу после входа

| | |
|---|---|
| **Было** | Логин записал новый JWT, но в полёте ещё висели GET `/api/users` и др. со **старым** токеном → 403 → тост и разлогин |
| **Стало** | `apiClient` шлёт `potok-auth-expired` только если токен в localStorage **тот же**, которым ходили |
| **Где** | `apiClient.js` |
| **Нюанс** | JWT не истекает за 15 минут. Выкидывание с другого устройства — `tokenVersion` после logout, это отдельно |

### Сайдбар APK не видит свои сообщения с другого устройства

| | |
|---|---|
| **Было** | `receive_message` / lastMessage слали всем **кроме** отправителя (чтобы не дублировать у себя). Второй телефон/веб того же user не узнавал о своём же тексте |
| **Стало** | `emitToUser` и отправителю тоже. Дедуп по `id` / `clientId` |
| **Где** | `socketHandlers.js`, `useMessages.js` |

### Пуш `Message is too large` (4 КБ)

| | |
|---|---|
| **Было** | В FCM data клали полный текст + title + body → Android отвергал |
| **Стало** | Title ~80, body ~180 символов; в data только `chatId`, `senderId`, `url`, `messageId`, `tag` |
| **Где** | `pushService.js`, `socketHandlers.js` |

### Мат при регистрации → «Что-то пошло не так»

| | |
|---|---|
| **Было** | Валидатор иногда отдавал массив `errors` без `error`; клиент брал только `data.error` |
| **Стало** | Сервер всегда `{ error, errors }`. Клиент склеивает оба |
| **Где** | `validation.js`, `Auth.jsx`, `authController.js` |

### «Ответить» в канале ничего не делало

| | |
|---|---|
| **Было** | Участник read-only, инпут скрыт, Reply ставил `replyingTo`, слать было некуда |
| **Стало** | Reply в канале = тред (комментарий), если `Channel.commentsEnabled`. Админ тумблер в профиле канала. Личка/группа — цитата `replyToId` как WhatsApp |
| **Где** | схема + `MessageInput.jsx`, `channelController.js`, `socketHandlers.js` |

### Закреп в начале истории не прыгал

| | |
|---|---|
| **Было** | Клик искал `[data-message-id]` в DOM. Сообщение ещё не подгружено пагинацией — no-op. После ручного скролла вдруг срабатывало |
| **Стало** | Цикл `loadHistory` (до ~20 страниц), потом scroll + подсветка |
| **Где** | `ChatArea.jsx`, `useMessages.js` |

### Сообщения пропадали при плохой сети

| | |
|---|---|
| **Было** | emit без ack: оптимистики не было, сокет молча не доставил — пузыря нет |
| **Стало** | Временный `clientId`, ack сервера, таймаут 12 с, кнопка «Повторить». Фокус в textarea после send, чтобы клавиатура не закрывалась |
| **Где** | `useSocket.js`, `useMessageHandlers.js`, `MessageItem.jsx` |

### Жалобы

Пишутся в `Report`. Письмо на `REPORT_EMAIL` (иначе `SMTP_USER`), тот же Unisender/SMTP что сброс пароля. Щит в сайдбаре, если `ADMIN_USER_IDS` содержит твой id. Это **не** отдельный админский аккаунт.

### Логи `🚪 Сокет … в комнате`

Убраны из `join_chat` — при росте онлайна забивали pm2.

### Forced reflow в Chrome

Не чинили: предупреждения DevTools про тяжёлый JS, продукт не ломают.

---

## 17–18 авг 2026

### JWT после рестарта сервера снова «жил»

| | |
|---|---|
| **Было** | Logout клал токен в RAM-blacklist. `pm2 restart` — память пустая, JWT до `exp` снова валиден. Стор так пускать нельзя |
| **Стало** | `User.tokenVersion` в PostgreSQL. Logout делает `increment`. Middleware и socket handshake сравнивают с JWT |
| **Где** | миграция `20260817180000_add_user_token_version`, `auth.js`, `authController.js`, `socketHandlers.js` |
| **Нюанс** | Один logout = выход везде. Так и задумано |

### Сброс пароля вёл на localhost

| | |
|---|---|
| **Было** | В `.env` две строки `FRONTEND_URL` или localhost сверху. dotenv берёт первую |
| **Стало** | Одна строка `https://potokmessenger.ru`. Код игнорирует localhost/пустой и подставляет прод |
| **Где** | `email.js`, `.env` на VPS |

### Mute не работал в личке / пуш всё равно уходил

| | |
|---|---|
| **Было** | Не было устойчивой строки mute для привата |
| **Стало** | upsert `PrivateChatMember`; пуш не шлётся если `muted` |
| **Где** | mute-контроллер, `socketHandlers.js` (блок FCM) |

### Пуш лички открывал «чат с собой»

| | |
|---|---|
| **Было** | В push `chatId` = `user_{receiver}` глазами отправителя |
| **Стало** | Получателю отдаём `user_{senderId}` |
| **Где** | `socketHandlers.js` |

### Кик из канала: «уже участник» на повторной заявке

| | |
|---|---|
| **Было** | `JoinRequest` не сбрасывался |
| **Стало** | Сброс заявки при кике/выходе |
| **Где** | `channelController.js` |

### Скрыть контакт = вырезать из БД

| | |
|---|---|
| **Было** | DELETE контакта, переписка «терялась» из списка |
| **Стало** | `Contact.hidden`, секция «Скрытые», `PATCH unhide`. Пуши остаются |
| **Где** | миграция `20260818220000_add_contact_hidden` |

### 403 JWT vs 403 «не участник»

| | |
|---|---|
| **Было** | Любой 403 → «сессия истекла» |
| **Стало** | Разлогин только если в тексте 403 есть «токен» / 401. Иначе закрыть чат и тост |
| **Где** | `apiClient.js`, `potok-chat-forbidden` в `App.jsx` |

### Прочее за 17–18

- Онлайн-точка, mute-бейдж, пагинация без прыжка скролла.
- StatusBar: светлые иконки на тёмной теме (`@capacitor/status-bar`).
- Профиль APK: safe-area, крестик не под вырезом, заявки не под навбаром.
- Голос: ✕ отмена / ➤ отправка; native recorder в APK.
- Фото: до 5 за раз, зум и свайп в просмотре.
- React #310: хуки в сайдбаре до early-return.
- Форма входа: `autocomplete` — сохранение логина в APK.
- Назад: модалки → чат → выход, не системное меню.

---

## 14–15 авг 2026

### Multi-device `onlineUsers`

| | |
|---|---|
| **Было** | `Map userId → один socket.id` — веб и APK вытесняли друг друга |
| **Стало** | `userId → Set<socketId>` + `emitToUser` / `joinUserToRoom` / `leaveUserFromRoom` |
| **Где** | `onlineUsers.js`, `socketHandlers.js` |
| **Нюанс** | Offline только когда отвалился **последний** сокет |

### ProfilePanel refetch-шторм

| | |
|---|---|
| **Было** | Каждый рендер новый `activeChat={{...messages}}` → refetch members/mute |
| **Стало** | deps на `activeChat?.id`; `profileActiveChat` через `useMemo` **после** `activeMessages` |
| **Где** | `ProfilePanel.jsx`, `App.jsx` |
| **Нюанс** | Сначала TDZ: `Cannot access 'activeMessages' before initialization` |

### Spoof + rate-limit + первый logout

| | |
|---|---|
| **Было** | `channel_updated` без проверки; register без лимита; logout только чистил localStorage |
| **Стало** | authz; `authLimiter`; `POST /api/auth/logout`. Blacklist в RAM потом заменили `tokenVersion` (17 авг) |
| **Бонус** | `delete_channel` / `delete_group` — emit только участникам, не `io.emit` всем |

### Два баннера пуша в Chrome

| | |
|---|---|
| **Было** | И `notification`, и `webpush.notification` |
| **Стало** | Один верхний `notification`; SW не рисует второй, если payload уже с `notification` |
| **Где** | `pushService.js`, `firebase-messaging-sw.js` |

### Загрузка картинок 500

| | |
|---|---|
| **Было** | ACL `public-read` на Yandex S3 + `showToast is not defined` |
| **Стало** | Без ACL; fallback `public/uploads`; `showToast` проп |
| **Где** | `s3Service.js`, `uploadController.js` |

### Join-requests 403

| | |
|---|---|
| **Было** | UI думал «админ» по старому `members`, API отвечал 403 |
| **Стало** | Сброс members при смене чата; `isAdmin` = creator или admin |
| **Нюанс** | 403 для обычного участника — норма, не баг localhost↔VPS |

---

## Live-debug APK (не для публичной сборки)

Два конфига:

| Файл | Статус |
|------|--------|
| `messenger-refactored/src/config.js` | Единственный рабочий |
| `messenger-refactored/config.js` | Заглушка, не импортировать |

Live:

- `.env.local` → `VITE_API_URL=http://192.168.x.x:5001`
- `capacitor.config.json` → `server.url: http://192.168.x.x:5173` + `cleartext: true`
- `CapacitorHttp.enabled: false`
- `android:usesCleartextTraffic="true"`; Vite `server.host: true`

### HTML вместо JSON

Симптом: `Unexpected token '<'`. Запрос попал на Vite `:5173`, а не на API `:5001`, либо `CapacitorHttp: true` подменил fetch. Проверка: Express без токена на `/api/chats` → **401 JSON**; Vite на том же пути → **200 HTML**.

### Голос: `getUserMedia` undefined

Live по `http://IP` — не secure context. В APK — `capacitor-voice-recorder` + `RECORD_AUDIO`. Нужна пересборка APK, не hot reload.

Чеклист live: backend `:5001`, Vite `:5173` в LAN, IP совпадает в `.env.local` и Capacitor, после native-плагинов — Run из Android Studio. В Logcat: `🔧 [config] API_BASE_URL = http://…:5001`.

Release: убрать блок `"server"`, убрать `VITE_API_URL`, `npm run build` → `npx cap sync android`.

---

## RuStore Push

Свой Capacitor-мост, FCM не выкидываем.

| Куда | Что |
|------|-----|
| Native | `PotokApplication`, `PotokRuStoreMessagingService`, `RuStorePushPlugin` |
| JS | `src/plugins/rustorePush.js`, `pushRegistration.js` — FCM **и** RuStore |
| Server | `PushToken.platform` (`fcm` \| `rustore`), `vkpns.rustore.ru` |

`rustore_project_id` в `strings.xml`. На телефоне без RuStore `checkAvailability` = false — норма, останется FCM. Подпись APK одна и та же для обновлений с сайта.

---

## ИИ-бот (живой — не на этом VPS)

Заглушка `/ai` и `GET /api/ai/status` уже в репо, `AI_ENABLED=false`. Код прокси: `aiAssistant.js` (как drop-in из `potok-ai-bot`). LLM и Ollama на этот VPS не ставить. Когда будет отдельный сервис: `AI_USER_ID`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, затем флаг. Жалобы уже в `Report` — боту потом читать оттуда.
