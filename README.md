Проект состоит из двух частей:

Бэкенд: Node.js + Express + Prisma (PostgreSQL)

Фронтенд: React + Vite + Tailwind CSS

Реальное время: Socket.io

Хранилище: локальное для аватарок, S3 для медиа в чатах

Хранилище: локальное vs S3
Тип файла	Хранилище	Эндпоинт
Аватарки пользователей	Локально (public/uploads/)	PUT /api/users/avatar
Аватарки каналов/групп	Локально (public/uploads/)	PUT /api/channels/:id или PUT /api/chats/:id
Изображения в чатах	S3 (Yandex Cloud)	POST /api/upload
Аудиосообщения в чатах	S3 (Yandex Cloud)	POST /api/upload
Почему так:
Аватарки обновляются синхронно с данными профиля, их нужно сохранять и отдавать как можно быстрее. Медиа в чатах — это отдельные сущности, их объём может быть большим, поэтому они в облаке.

База данных
Движок: PostgreSQL (локально), на продакшене — тоже PostgreSQL.

Миграции: через Prisma (npx prisma migrate dev).

Модели: User, Message, Channel, Chat, Contact, JoinRequest, Thread, Reaction, PrivateChatMember, ChannelMember, ChatMember, PasswordReset.

Сокеты (Socket.io)
Основные события:

send_message — отправка сообщения

join_chat — подписка на комнату

typing / stop_typing — статус печатания

read_messages — отметка о прочтении

delete_message — удаление сообщения

add_member / remove_member — управление участниками

toggle_reaction — реакции на сообщения

create_thread — комментарии к сообщениям

 Аутентификация
JWT-токены, хранятся в localStorage.

Регистрация с валидацией пароля (заглавная, строчная, цифра, спецсимвол).

Восстановление пароля через email (Nodemailer, SMTP).
 Сборка APK
Используется Capacitor.

Сборка: npx cap add android → npx cap sync → npx cap open android.

Для продакшена: нужно настроить домен и HTTPS.

Деплой
Бэкенд: VPS (PM2, Nginx).

Фронтенд: Vercel / Netlify / VPS.

БД: PostgreSQL на сервере.

S3: Yandex Cloud (или другой S3-совместимый провайдер).

Особенности и нюансы
Аватарки хранятся локально. Это решение было принято после неудачной попытки перенести их в S3. Причина: аватарки обновляются синхронно с профилем, и облачное хранилище создавало проблемы с кешированием и синхронизацией.

S3 только для медиа в чатах. Изображения и аудио загружаются через /api/upload и хранятся в облаке.

Обновление сайдбара после загрузки аватарки происходит через channelsVersion и contactsVersion (React-состояния).

Тост-уведомления вместо alert() и модалки подтверждения вместо confirm() — всё для лучшего UX.

Заявки на вступление в каналы — полноценная система с таймером повторной подачи.

Тёмная тема — сохраняется в localStorage.

