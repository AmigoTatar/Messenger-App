Название: Potok Messenger (Fullstack Chat App)
Тип: Мессенджер с реальным временем (WebSockets), группами, каналами, контактами, восстановлением пароля.
Статус: Почти готов к продакшену. Остались доработки по файлам, пуш-уведомлениям и сборка APK.
##  Технологии

Фронтенд:** React 18, Vite, Tailwind CSS, Socket.io-client  
Бэкенд:** Node.js, Express, Prisma ORM, Socket.io, JWT, Nodemailer  
База данных:** PostgreSQL (основная), SQLite (для разработки)  
Хранение файлов:** Yandex Cloud Object Storage (S3)  
Деплой:** VPS (Ubuntu), Nginx, PM2 
Структура папок
Messenger-App/
├── Server-Refactor/              # Бэкенд (Node.js + Express + Prisma)
│   ├── server.js                 # Точка входа
│   ├── .env                      # Переменные окружения (не в Git)
│   ├── .env.example              # Шаблон для .env (в Git)
│   ├── prisma/
│   │   ├── schema.prisma         # Модели БД (User, Message, Channel, Chat, Contact, PasswordReset...)
│   │   └── migrations/           # Миграции (включая индексы)
│   ├── src/
│   │   ├── controllers/          # Логика (auth, users, chats, channels, contacts, messages, password)
│   │   ├── routes/               # REST API (auth, users, channels, chats, messages, contacts, password, upload)
│   │   ├── middleware/           # auth.js (JWT), validation.js (валидация)
│   │   ├── socket/               # socketHandlers.js (всё реальное время)
│   │   └── utils/                # email.js (Nodemailer)
│   └── public/uploads/           # Локальное хранилище файлов (аватарки) S3-Фото, аудио
│
└── messenger-refactored/         # Фронтенд (React + Vite + Tailwind)
    ├── src/
    │   ├── components/           # Все UI-компоненты
    │   │   ├── Sidebar/          # Контакты, группы, каналы, модалки
    │   │   ├── ChatArea/         # Сообщения, реакции, треды, ввод
    │   │   ├── ProfilePanel/     # Информация о чате/канале/группе
    │   │   ├── Auth.jsx          # Вход / регистрация / восстановление пароля
    │   │   ├── ResetPassword.jsx # Сброс пароля по токену
    │   │   ├── Toast.jsx         # Уведомления (вместо alert)
    │   │   ├── LoadingSpinner.jsx
    │   │   └── ErrorBoundary.jsx # Ловит ошибки рендеринга
    │   ├── hooks/                # useAppState, useMessageHandlers, useSocket, useMessages, useChats, useContacts...
    │   ├── contexts/             # MessageContext, AppContext
    │   ├── utils/                # chatUtils, dateUtils, avatarUtils, soundUtils
    │   ├── config.js             # API_BASE_URL
    │   └── main.jsx              # React Router (/, /reset-password)
    └── vite.config.js            

. БАЗА ДАННЫХ (Prisma + PostgreSQL)
Модели (9 таблиц)
Модель	Описание
User	Пользователи (username, email, password, avatar)
Message	Сообщения (текст, медиа, статусы, ссылки на чаты/каналы)
Channel	Публичные каналы (только админы пишут)
Chat	Групповые чаты
Contact	Контакты (связь пользователь → пользователь, взаимная)
ChannelMember	Участники каналов (роль, muted, lastReadAt)
ChatMember	Участники групп (muted, lastReadAt)
PrivateChatMember	Приватные чаты (lastReadAt, muted)
Thread	Комментарии к сообщениям
Reaction	Реакции на сообщения
PasswordReset	Токены для сброса пароля
Индексы
•	Добавлены индексы на все внешние ключи (senderId, receiverId, chatId, channelId, userId и др.)
•	 Индексы на createdAt, status, составные индексы для ускорения запросов.
Миграции
•	Все миграции в prisma/migrations/
•	 Индексы добавлены (ускорение запросов)

3. БЭКЕНД (Node.js + Express)
Контроллеры (8 штук)
Контроллер	Описание
authController	Регистрация, вход, валидация (JWT)
userController	Список пользователей, поиск, обновление профиля, аватарка
channelController	CRUD каналов, участники
chatController	CRUD групповых чатов, участники
messageController	Получение истории с пагинацией, закрепления, редактирование
contactController	Список контактов, добавление/удаление, поиск пользователей
passwordController	Запрос на сброс пароля, сброс пароля по токену
uploadController	Загрузка файлов (multer) → планируется S3
Роуты (9 штук)
Роут	Эндпоинты
/api/auth	/register, /login, /forgot-password, /reset-password
/api/users	GET /, PUT /profile, PUT /avatar, GET /search
/api/channels	CRUD каналов, участники
/api/chats	CRUD групп, участники
/api/messages	GET / (история), GET /pinned, 
POST /:id/pin, PUT /:id, POST /:id/reactions
/api/contacts	GET /, POST /, DELETE /:id, GET /search
/api/upload	POST / (загрузка файлов)
/api/read	POST / (отметка о прочтении)
/api/unread	GET / (непрочитанные)
Socket Handlers (io.on('connection'))
•	join_chat — подписка на комнату
•	send_message — отправка сообщения (сохранение в БД + рассылка)
•	delete_message — удаление сообщения (только автор или админ в группе/канале)
•	read_messages — обновление lastReadAt и статуса read
•	typing / stop_typing — статус "печатает..."
•	add_member / remove_member — добавление/удаление участников в группах/каналах
•	delete_channel / delete_group — удаление каналов/групп
•	create_thread — комментарии к сообщениям (треды)
•	toggle_reaction — реакции (эмодзи)
•	contact_added — сокет-событие для обновления контактов у второго пользователя
Middleware
•	auth.js — проверка JWT-токена
•	validation.js — валидация (регистрация, логин, сообщения, поиск, создание чатов/каналов)
Утилиты
•	email.js — отправка писем через Nodemailer (настройка SMTP: Яндекс)
•	chatUtils.js — normalizeChatId, extractNumericId, getActiveChatData (вынесены из App.jsx)
4. ФРОНТЕНД (React + Vite + Tailwind)
Структура компонентов
•	App.jsx — главный компонент (≈300 строк после рефакторинга)
•	Sidebar — список контактов, групп, каналов, поиск
•	ChatArea — сообщения, ввод, реакции, треды, закрепления
•	ProfilePanel — информация о чате, участники, медиа, аудио, редактирование
•	Auth — вход / регистрация / восстановление пароля
•	ResetPassword — сброс пароля по токену
•	Toast — уведомления (замена alert)
•	LoadingSpinner — спиннеры загрузки
•	ErrorBoundary — ловит ошибки рендеринга
Хуки (8 штук)
Хук	Описание
useAppState	Все состояния (user, activeChatId, версии, рефы)
useMessageHandlers	Все обработчики (selectChat, sendMessage, deleteMessage, receiveMessage, pin, createChannel, createGroupChat, chatUpdate, logout, реакции, треды, удаление, обновление пользователя)
useSocket	Подключение к сокету, joinChat, sendMessage, emit
useMessages	Управление сообщениями (getMessages, addMessage, loadHistory, hasMore, loading, deleteMessageLocally)
useChats	Управление чатами, группами, каналами (загрузка, добавление, удаление)
useContacts	Управление контактами (список, добавление, удаление, поиск)
useUnread	Непрочитанные (счётчики, сброс, обновление)
useMarkAsRead	Отметка о прочтении (debounced)
useTheme	Тёмная / светлая тема
Контексты
•	MessageContext — для отправки сообщений (sendMessage)
•	AppContext — (планируется) для глобального состояния
UI-фичи
•	 Тёмная / светлая тема (переключается в сайдбаре)
•	 Адаптивный дизайн (мобильная версия)
•	 Индикаторы загрузки (спиннеры)
•	 Toast-уведомления (вместо alert)
•	 Escape — закрывает чат / профиль / модалки

5. ФИЧИ (реализовано и работает)
Авторизация
•	 Регистрация / Вход (JWT)
•	 Валидация пароля (заглавная, строчная, цифра, спецсимвол)
•	 Восстановление пароля (через email, токен в письме, сброс)
Чаты
•	 Приватные чаты (с контактами)
•	 Групповые чаты (создание, добавление/удаление участников)
•	 Каналы (только админы пишут)
•	 Отправка текста, фото, аудио
•	 Реакции 
•	 Треды (комментарии)
•	 Закрепление сообщений (автор / админ / создатель группы/канала)
•	 Редактирование своих сообщений
•	 Удаление сообщений (только свои, в группах — только автор)
•	 Заявки на вступление в каналы — полноценная система с таймером повторной подачи
Контакты
•	Добавление/удаление контактов (взаимное)
•	 Поиск пользователей для добавления
•	 Модалка " Добавить контакт"
•	 Обновление lastMessage в сайдбаре (при отправке и удалении)
•	 Обновление имени пользователя в сайдбаре (у всех участников)
Реальное время
•	 WebSocket (Socket.io)
•	 Статус "печатает..."
•	 Счётчики непрочитанных (сбрасываются при открытии чата)
•	 Звук уведомления
Оптимизация
•	Индексы в БД
•	Graceful shutdown
•	Валидация на сервере (почти для всех эндпоинтов)
•	Toast-уведомления (замена alert)
•	Спиннеры (индикаторы загрузки)
•	useMemo для activeMessages
•	Вспомогательные функции вынесены в chatUtils.js
•	console.log удаляются в продакшене (drop_console)

7. НЬЮАНСЫ
.env
•	В Git лежит .env.example (шаблон).
•	 Сам .env — в .gitignore (никогда не пушить!).
•	Почта (SMTP): сейчас Яндекс (работает), потом на домен перейдём на Unisender.
•	JWT_SECRET: должен быть уникальным и сложным.
Харнилище
Особенности и нюансы Аватарки хранятся локально. Это решение было принято после неудачной попытки перенести их в S3. Причина: аватарки обновляются синхронно с профилем, и облачное хранилище создавало проблемы с кешированием и синхронизацией
Хуки
•	useMemo только для activeMessages — больше не нужно.
•	useCallback — только для функций, которые передаются в дочерние компоненты.
•	useAppState — вынесены все состояния.
•	useMessageHandlers — все обработчики.
Error Boundary
•	Есть, обёрнут App.
•	При ошибке показывает заглушку (не падает всё приложение).
Индексы
•	Добавлены в Prisma (ускорение запросов).
Сборка APK
•	Пока не начата.
•	Планируется через Capacitor (после всех фич).

 👤 Автор

**AmigoTatar**  
[GitHub](https://github.com/AmigoTatar)  
Проект в сети: [potokmessenger.ru](https://potokmessenger.ru)

