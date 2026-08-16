# NOTES — слепок работы 14–15 авг 2026

Краткий журнал: что чинили, как было / как стало, нюансы.

---

## Закрыли «оставшиеся 3» (стабильность / security)

### 1. Multi-device `onlineUsers`

| | |
|---|---|
| **Было** | `Map userId → один socket.id` — web и APK вытесняли друг друга |
| **Стало** | `userId → Set<socketId>` + `emitToUser` / `joinUserToRoom` / `leaveUserFromRoom` |
| **Где** | `Server-Refactor/src/utils/onlineUsers.js`, `socketHandlers.js`, chat/channel/contact/message controllers |
| **Нюанс** | Offline только когда отвалился **последний** сокет |

### 2. ProfilePanel refetch-шторм

| | |
|---|---|
| **Было** | Каждый рендер новый `activeChat={{...messages}}` → refetch members/mute |
| **Стало** | deps на `activeChat?.id`; `profileActiveChat` через `useMemo` **после** `activeMessages` |
| **Где** | `messenger-refactored/src/components/ProfilePanel/ProfilePanel.jsx`, `App.jsx` |
| **Нюанс** | Сначала TDZ: `Cannot access 'activeMessages' before initialization` — `useMemo` перенесли ниже объявления `activeMessages` |

### 3. Spoof + rate-limit + JWT revoke

| | |
|---|---|
| **Было** | `channel_updated` / `chat_updated` без проверки; register без лимита; logout только чистил localStorage |
| **Стало** | authz creator/admin; `authLimiter` на `/register`; `POST /api/auth/logout` + in-memory blacklist; проверка в JWT middleware и socket auth |
| **Где** | `socketHandlers.js`, `authRoutes.js`, `authController.js`, `tokenRevoke.js`, `middleware/auth.js`, logout в `useAppHandlers` / `useMessageHandlers` |
| **Нюанс** | Blacklist в RAM — после рестарта сервера отозванный JWT снова валиден до `exp` (на прод позже Redis / `tokenVersion`) |
| **Бонус** | `delete_channel` / `delete_group` — emit только участникам, не `io.emit` всем |

---

## Пуши (web — два баннера)

| | |
|---|---|
| **Было** | И `notification`, и `webpush.notification` → Chrome рисовал **два** баннера |
| **Стало** | Один верхний `notification`; foreground/SW не делают второй `showNotification`, если уже есть `notification` |
| **Где** | `Server-Refactor/src/services/pushService.js`, `messenger-refactored/src/firebase.js`, `public/firebase-messaging-sw.js` |
| **Нюанс** | Логи `activeTokens=N` — если 2, дубль из двух токенов в БД |

---

## Загрузка картинок

| | |
|---|---|
| **Было** | 500 на `/api/upload` (часто ACL `public-read` на Yandex S3) + `showToast is not defined` |
| **Стало** | Без ACL; fallback в `public/uploads`; `showToast` проп из `ChatArea` |
| **Где** | `s3Service.js`, `uploadController.js`, `MessageInput.jsx`, `ChatArea.jsx` |

---

## Join-requests 403

| | |
|---|---|
| **Было** | UI думал «админ» (старые `members` / только `role=admin`), API отвечал 403 |
| **Стало** | Сброс `members` при смене чата; `isAdmin` = creator **или** admin; 403 тихо в панели; на сервере creator тоже `canManage` |
| **Где** | `ProfilePanel.jsx`, `JoinRequestsPanel.jsx`, `channelController.js` |
| **Нюанс** | Не баг localhost↔VPS: 403 для обычного участника — норма |

---

## App.jsx рефакторинг

- ~840 строк — для корневого контейнера толсто, но **не критично**.
- Жир: socket-оркестрация (~member/channel/chat handlers).
- План на потом: `useSocketBindings` → `useChatNavigation` → `MessengerShell`.
- **Пока не трогали.**

---

## APK live-debug

### Два конфига

| Файл | Статус |
|------|--------|
| **`messenger-refactored/src/config.js`** | Единственный рабочий |
| **`messenger-refactored/config.js`** | Старый мусор — заглушка, не импортировать |

Live:

- `.env.local` → `VITE_API_URL=http://192.168.0.11:5001` (подставь свой IP ПК)
- `capacitor.config.json` → `server.url: http://192.168.0.11:5173` + `cleartext: true`
- `CapacitorHttp.enabled: false` (иначе fetch может улетать на Vite)

Также: `android:usesCleartextTraffic="true"` в `AndroidManifest.xml`; Vite `server.host: true`.

### HTML вместо JSON

| | |
|---|---|
| **Симптом** | `Unexpected token '<'` / «ожидали JSON, получили `<!doctype`» |
| **Причина 1** | Запрос не на API `:5001`, а на Vite `:5173` (Vite на `/api/*` отдаёт HTML 200) |
| **Причина 2** | `CapacitorHttp: true` подменял `fetch` |
| **Стало** | `CapacitorHttp: false` + `npx cap sync`; в `apiClient` явная ошибка с URL, если ответ не JSON |

Проверка с ПК: Express на `/api/chats` без токена → **401 JSON**; Vite на том же пути → **200 HTML**.

### Release APK (потом)

1. Убрать блок `"server"` из `capacitor.config.json`
2. Убрать `VITE_API_URL` из `.env.local` (останется `https://potokmessenger.ru`)
3. `npm run build` → `npx cap sync android` → собрать APK

---

## Голосовые в APK

| | |
|---|---|
| **Было** | `Cannot read properties of undefined (reading 'getUserMedia')` |
| **Причина** | Live-reload по `http://IP` — не secure context → `navigator.mediaDevices` = `undefined` |
| **Стало** | `RECORD_AUDIO` + плагин `capacitor-voice-recorder`; APK = native, web = `getUserMedia` |
| **Где** | `AndroidManifest.xml`, `MessageInput.jsx` |
| **Нюанс** | Нужна **пересборка APK** (нативный плагин), не только hot reload Vite |

---

## Чеклист live APK

1. Backend на ПК, порт **5001**
2. Frontend: `npm run dev` (Vite **5173**, слушает LAN)
3. IP в `.env.local` и `capacitor.config.json` совпадает
4. После смены native-плагинов / манифеста — **Run из Android Studio**
5. В Logcat: `🔧 [config] API_BASE_URL = http://…:5001`

---

## Следующие кандидаты (не сделано)

- **Блокер стора:** JWT revoke переживает рестарт сервера (`tokenVersion` в User или Redis). Сейчас blacklist только в RAM — после рестарта logout-токены снова валидны до `exp`. Делать вместе с багами APK, до публикации в RuStore.
- Рефакторинг `App.jsx` (socket bindings)
- Деплой серверных правок на VPS
- **ИИ-бот в мессенджер** (см. ниже) — после стабилизации текущего прод-контура

---

## RuStore Push (15 авг 2026)

Свой Capacitor-мост, FCM не трогаем.

| Куда | Что |
|------|-----|
| Native | `PotokApplication`, `PotokRuStoreMessagingService`, `RuStorePushPlugin` |
| JS | `src/plugins/rustorePush.js`, `pushRegistration.js` регистрирует FCM **и** RuStore |
| Server | `PushToken.platform` (`fcm` \| `rustore`), отправка на `vkpns.rustore.ru` |

### Что вписать тебе

1. **APK** — `android/app/src/main/res/values/strings.xml` → `rustore_project_id` (сейчас `REPLACE_ME`)
2. **Сервер** `.env`:
   ```
   RUSTORE_PROJECT_ID=...
   RUSTORE_SERVICE_TOKEN=...
   ```
3. Миграция: в `Server-Refactor` выполнить `npx prisma migrate deploy` (или `prisma db push`)
4. Пересобрать APK из Android Studio (нативный SDK)
5. Подпись debug/release APK должна совпасть с отпечатком в RuStore Console
6. На телефоне нужен RuStore (дистрибьютор), иначе `checkAvailability` = false — это нормально, останется FCM

---

## Дальше: ИИ-бот (не сейчас)

Набросок уже есть на GitHub (ссылку кинуть в новом чате). Стек наброска:

- Ollama + `gemma2:2b`
- память / контекст диалога
- FastAPI-сервер
- RAG, база 25+ фактов (не только про мессенджер)

План: отдельный бот-сервис, интеграция в `Server-Refactor` (сокет/REST → FastAPI), не смешивать LLM в Node. В этом репо пока не трогаем.
