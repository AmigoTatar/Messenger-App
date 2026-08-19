# NOTES

Журнал: что ломалось, почему, как починили.

Актуальный статус продукта, стек и смоук — [`README.md`](README.md).  
Деплой — [`DEPLOY.md`](DEPLOY.md).

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

## Live-debug APK (не для стора)

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

`rustore_project_id` в `strings.xml`. На телефоне без RuStore `checkAvailability` = false — норма, останется FCM. Подпись APK = отпечаток в Console.

---

## ИИ-бот (не сейчас)

Набросок на GitHub отдельно. Идея: Ollama + маленький сервис, в Node не мешать LLM. Жалобы уже в `Report` — боту потом читать оттуда. В этом репо не стартовать до релиза.
