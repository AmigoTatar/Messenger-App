
const jwt = require('jsonwebtoken');
const {
    addOnlineUser,
    removeOnlineUser,
    emitToUser,
    getOnlineSockets,
    joinUserToRoom,
    leaveUserFromRoom,
    isUserOnline,
    getOnlineUserIds,
    onlineUsers,
} = require('../utils/onlineUsers');
const { isTokenRevoked } = require('../utils/tokenRevoke');
const { maybeReplyToUser } = require('../services/aiAssistant');

const setupSocket = (io, prisma) => {
    // === АУТЕНТИФИКАЦИЯ 
    io.use((socket, next) => {
        const token = (socket.handshake.auth && socket.handshake.auth.token) ||
            (socket.handshake.headers['authorization'] && socket.handshake.headers['authorization'].split(' ')[1]);

        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }

        if (isTokenRevoked(token)) {
            return next(new Error('Authentication error: Token revoked'));
        }

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) return next(new Error('Authentication error: Invalid token'));
            const userId = Number(decoded.userId);
            try {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { tokenVersion: true },
                });
                if (!user || (decoded.tokenVersion ?? 0) !== user.tokenVersion) {
                    return next(new Error('Authentication error: Token revoked'));
                }
                socket.userId = userId;
                socket.authToken = token;
                next();
            } catch (e) {
                next(new Error('Authentication error'));
            }
        });
    });

    io.on('connection', (socket) => {
        const currentUserId = socket.userId;
        console.log(`📡 Пользователь ${currentUserId} подключился: ${socket.id}`);

        addOnlineUser(currentUserId, socket.id);
        io.emit('user_status_change', { userId: currentUserId, status: 'online' });
        socket.emit('online_users', getOnlineUserIds());

        // ===  ПРИСОЕДИНЕНИЕ К КОМНАТЕ (только при наличии прав) ===
        socket.on('join_chat', async (chatId) => {
            if (!chatId) return;
            try {
                const still = await prisma.user.findUnique({ where: { id: currentUserId }, select: { id: true } });
                if (!still) {
                    socket.emit('account_deleted', { message: 'Аккаунт удалён' });
                    socket.disconnect(true);
                    return;
                }
                const { assertChatAccess } = require('../utils/chatAccess');
                const access = await assertChatAccess(currentUserId, String(chatId));
                if (!access.ok) {
                    console.warn(`🚫 join_chat denied user=${currentUserId} room=${chatId}: ${access.error}`);
                    return;
                }
                socket.join(String(chatId));
            } catch (err) {
                console.error('join_chat error:', err.message);
            }
        });

        // ===  ОТПРАВКА СООБЩЕНИЯ ===
        socket.on('send_message', async (messageData, ack) => {
            const replyAck = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            try {
                const still = await prisma.user.findUnique({ where: { id: currentUserId }, select: { id: true } });
                if (!still) {
                    socket.emit('account_deleted', { message: 'Аккаунт удалён' });
                    replyAck({ ok: false, error: 'Аккаунт удалён' });
                    socket.disconnect(true);
                    return;
                }

                const { text, mediaUrl, mediaType, activeChatId, isForwarded, replyToId, clientId } = messageData;
                if (!text && !mediaUrl) {
                    replyAck({ ok: false, error: 'Пустое сообщение' });
                    return;
                }
                if (text && text.length > 10000) {
                    replyAck({ ok: false, error: 'Слишком длинное сообщение' });
                    return;
                }
                if (!activeChatId) {
                    replyAck({ ok: false, error: 'Нет чата' });
                    return;
                }

                const senderId = currentUserId;
                let receiverId = null;
                let channelId = null;
                let chatId = null;

                // Определяем тип чата
                if (activeChatId.startsWith('user_')) {
                    receiverId = parseInt(activeChatId.replace('user_', ''), 10);
                    if (isNaN(receiverId)) return;
                    const block = await prisma.userBlock.findFirst({
                        where: {
                            OR: [
                                { blockerId: senderId, blockedId: receiverId },
                                { blockerId: receiverId, blockedId: senderId },
                            ],
                        },
                    });
                    if (block) {
                        const msg = block.blockerId === receiverId
                            ? 'Пользователь вас заблокировал'
                            : 'Вы заблокировали этого пользователя';
                        socket.emit('error', { message: msg });
                        replyAck({ ok: false, error: msg });
                        return;
                    }
                } else if (activeChatId.startsWith('channel_')) {
                    channelId = parseInt(activeChatId.replace('channel_', ''), 10);
                    if (isNaN(channelId)) return;
                    console.log(`📨 [send_message] Канал ${channelId}`);
                    const member = await prisma.channelMember.findFirst({
                        where: { channelId, userId: senderId }
                    });
                    if (!member) {
                        socket.emit('error', { message: 'Вы не участник канала' });
                        replyAck({ ok: false, error: 'Вы не участник канала' });
                        return;
                    }
                    if (member.role !== 'admin') {
                        socket.emit('error', { message: 'Только администраторы могут писать в канал' });
                        replyAck({ ok: false, error: 'Только администраторы могут писать в канал' });
                        return;
                    }
                } else if (activeChatId.startsWith('chat_')) {
                    chatId = parseInt(activeChatId.replace('chat_', ''), 10);
                    if (isNaN(chatId)) return;
                    console.log(`📨 [send_message] Групповой чат ${chatId}`);
                    const isMember = await prisma.chatMember.findFirst({
                        where: { chatId, userId: senderId }
                    });
                    if (!isMember) {
                        console.log(`❌ Юзер ${senderId} не участник группы ${chatId}`);
                        return;
                    }
                } else {
                    console.log(`❌ Неизвестный тип чата: ${activeChatId}`);
                    return;
                }

                // Сохраняем в БД
                const savedMessage = await prisma.message.create({
                    data: {
                        text: text || null,
                        mediaUrl: mediaUrl || null,
                        mediaType: mediaType || null,
                        senderId: senderId,
                        receiverId: receiverId,
                        channelId: channelId,
                        chatId: chatId,
                        isForwarded: isForwarded || false,
                        status: 'unread',
                        replyToId: replyToId ? Number(replyToId) : null,
                    },
                    include: {
                        sender: { select: { id: true, username: true, avatar: true } },
                        replyTo: {
                            select: {
                                id: true,
                                text: true,
                                senderId: true,
                                sender: { select: { username: true } },
                            },
                        },
                    }
                });

                // ====== PUSH-УВЕДОМЛЕНИЯ ======
try {
    const { sendPush } = require('../services/pushService');
    const senderName = savedMessage.sender?.username || 'Пользователь';
    const rawText = text || (mediaType === 'image' ? '📷 Фото' : mediaType === 'audio' ? '🎤 Голосовое' : '📎 Файл');
    const messageText = String(rawText).length > 180 ? `${String(rawText).slice(0, 180)}…` : String(rawText);
    // В привате у каждого свой id: получатель открывает чат с отправителем (user_${senderId}).
    // activeChatId отправителя = user_${receiverId} — это чат «с самим собой» у получателя.
    const pushChatId = receiverId
        ? `user_${senderId}`
        : (activeChatId || (chatId ? `chat_${chatId}` : channelId ? `channel_${channelId}` : 'potok'));
    const frontend = (!process.env.FRONTEND_URL || /localhost|127\.0\.0\.1/i.test(process.env.FRONTEND_URL))
        ? 'https://potokmessenger.ru'
        : String(process.env.FRONTEND_URL).replace(/\/$/, '');
    const pushMeta = {
        chatId: pushChatId,
        senderId: String(senderId),
        tag: `potok_${pushChatId}`,
        url: `${frontend}/?chat=${encodeURIComponent(pushChatId)}`,
        messageId: String(savedMessage.id),
    };

    // Приватный чат
    if (receiverId) {
        const muteRow = await prisma.privateChatMember.findUnique({
            where: { userId_otherUserId: { userId: receiverId, otherUserId: senderId } },
        });
        if (!muteRow?.muted) {
            const tokens = await prisma.pushToken.findMany({
                where: { userId: receiverId, isActive: true }
            });
            for (const t of tokens) {
                await sendPush(t.token, `💬 ${senderName}`, messageText, pushMeta, t.platform);
            }
        }
    }

    // Групповой чат — только активные токены
    if (chatId) {
        const chat = await prisma.chat.findUnique({
            where: { id: chatId },
            select: { name: true }
        });
        const chatName = chat?.name || 'Группа';

        const members = await prisma.chatMember.findMany({
            where: { chatId, userId: { not: senderId } },
            include: {
                user: {
                    include: {
                        pushTokens: { where: { isActive: true } }
                    }
                }
            }
        });
        for (const m of members) {
            if (m.muted) continue;
            for (const t of m.user.pushTokens) {
                await sendPush(t.token, `👥 ${chatName}`, `💬 ${senderName}: ${messageText}`, pushMeta, t.platform);
            }
        }
    }

    // Канал — только активные токены
    if (channelId) {
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { name: true }
        });
        const channelName = channel?.name || 'Канал';

        const members = await prisma.channelMember.findMany({
            where: { channelId, userId: { not: senderId } },
            include: {
                user: {
                    include: {
                        pushTokens: { where: { isActive: true } }
                    }
                }
            }
        });
        for (const m of members) {
            if (m.muted) continue;
            for (const t of m.user.pushTokens) {
                await sendPush(t.token, `📢 ${channelName}`, `💬 ${senderName}: ${messageText}`, pushMeta, t.platform);
            }
        }
    }
} catch (pushErr) {
    console.error('❌ Ошибка отправки push:', pushErr.message);
}

                const newMessage = {
                    id: savedMessage.id,
                    text: savedMessage.text,
                    mediaUrl: savedMessage.mediaUrl,
                    mediaType: savedMessage.mediaType,
                    status: savedMessage.status,
                    createdAt: savedMessage.createdAt,
                    senderId: savedMessage.senderId,
                    receiverId: savedMessage.receiverId,
                    channelId: savedMessage.channelId,
                    chatId: savedMessage.chatId,
                    sender: savedMessage.sender,
                    activeChatId: activeChatId,
                    isForwarded: savedMessage.isForwarded || false,
                    replyToId: savedMessage.replyToId || null,
                    replyTo: savedMessage.replyTo || null,
                    clientId: clientId || null,
                };

                // === РАССЫЛКА ===
                if (chatId) {
                    io.to(`chat_${chatId}`).emit('receive_message', newMessage);
                    const members = await prisma.chatMember.findMany({
                        where: { chatId },
                        select: { userId: true }
                    });
                    for (const member of members) {
                        emitToUser(io, member.userId, 'receive_message', newMessage);
                        emitToUser(io, member.userId, 'chat_updated', {
                            chatId,
                            lastMessage: newMessage
                        });
                        if (member.userId === senderId) continue;
                        const unreadCount = await prisma.message.count({
                            where: {
                                chatId,
                                senderId: { not: member.userId },
                                status: 'unread'
                            }
                        });
                        emitToUser(io, member.userId, 'unread_updated', {
                            type: 'chat',
                            id: chatId,
                            count: unreadCount
                        });
                    }
                } else if (channelId) {
                    io.to(`channel_${channelId}`).emit('receive_message', newMessage);
                    const members = await prisma.channelMember.findMany({
                        where: { channelId },
                        select: { userId: true }
                    });
                    for (const member of members) {
                        emitToUser(io, member.userId, 'receive_message', newMessage);
                        emitToUser(io, member.userId, 'channel_updated', {
                            channelId,
                            lastMessage: newMessage
                        });
                        if (member.userId === senderId) continue;
                        const unreadCount = await prisma.message.count({
                            where: {
                                channelId,
                                senderId: { not: member.userId },
                                status: 'unread'
                            }
                        });
                        emitToUser(io, member.userId, 'unread_updated', {
                            type: 'channel',
                            id: channelId,
                            count: unreadCount
                        });
                    }
                } else if (receiverId) {
                    emitToUser(io, senderId, 'receive_message', newMessage);
                    emitToUser(io, receiverId, 'receive_message', newMessage);
                    const unreadCount = await prisma.message.count({
                        where: {
                            senderId: senderId,
                            receiverId: receiverId,
                            channelId: null,
                            chatId: null,
                            status: 'unread'
                        }
                    });
                    emitToUser(io, receiverId, 'unread_updated', {
                        type: 'private',
                        id: senderId,
                        count: unreadCount
                    });
                    maybeReplyToUser({ io, prisma, emitToUser, savedMessage, senderId, receiverId })
                        .catch((err) => console.error('[ai] reply failed', err.message));
                }

                replyAck({ ok: true, message: newMessage });
            } catch (error) {
                console.error('❌ [send_message] Ошибка:', error);
                replyAck({ ok: false, error: 'Не удалось отправить' });
            }
        });

 // ===  УДАЛЕНИЕ СООБЩЕНИЯ 
socket.on('delete_message', async ({ messageId, activeChatId }) => {
    try {
        console.log(` [delete_message] messageId: ${messageId}, activeChatId: ${activeChatId}`);

        const message = await prisma.message.findUnique({
            where: { id: Number(messageId) },
            include: {
                sender: { select: { id: true, username: true, avatar: true } }
            }
        });

        if (!message) {
            console.log('❌ [delete_message] Сообщение не найдено');
            return;
        }

        //  ПРОВЕРКА ПРАВ: в групповых чатах удалять можно только свои сообщения
        if (message.chatId) {
            if (message.senderId !== socket.userId) {
                console.log(` [delete_message] Пользователь ${socket.userId} пытается удалить чужое сообщение в группе`);
                socket.emit('error', { message: 'В групповом чате можно удалять только свои сообщения' });
                return;
            }
        }

        //  В приватных чатах и каналах — только автор может удалять
        if (message.senderId !== socket.userId) {
            console.log(` [delete_message] Пользователь ${socket.userId} не является автором сообщения`);
            socket.emit('error', { message: 'Вы не можете удалить это сообщение' });
            return;
        }
        let otherUserId = null;
if (activeChatId?.startsWith('user_')) {
    // Определяем собеседника: если текущий пользователь — отправитель, то otherUserId = receiverId, иначе senderId
    otherUserId = message.senderId === socket.userId ? message.receiverId : message.senderId;
    console.log(`🗑️ [delete_message] Приватный чат, otherUserId: ${otherUserId}`);
}

        // Удаляем реакции и треды
        await prisma.reaction.deleteMany({ where: { messageId: Number(messageId) } });
        await prisma.thread.deleteMany({ where: { messageId: Number(messageId) } });

        // Обновляем сообщение
        const updatedMessage = await prisma.message.update({
            where: { id: Number(messageId) },
            data: {
                text: "Сообщение удалено",
                mediaUrl: null,
                mediaType: null,
                isDeleted: true,
                isForwarded: false
            }
        });

const deletePayload = {
    messageId: updatedMessage.id,
    activeChatId,
    isDeleted: true,
    otherUserId,
    senderId: message.senderId,
    receiverId: message.receiverId,
};

        // Отправляем всем участникам
        if (activeChatId?.startsWith('channel_')) {
            const channelId = parseInt(activeChatId.replace('channel_', ''), 10);
            io.to(`channel_${channelId}`).emit('message_deleted', deletePayload);
            const members = await prisma.channelMember.findMany({
                where: { channelId },
                select: { userId: true }
            });
            for (const member of members) {
                emitToUser(io, member.userId, 'message_deleted', deletePayload);
            }
        } else if (activeChatId?.startsWith('chat_')) {
            const chatId = parseInt(activeChatId.replace('chat_', ''), 10);
            io.to(`chat_${chatId}`).emit('message_deleted', deletePayload);
            const members = await prisma.chatMember.findMany({
                where: { chatId },
                select: { userId: true }
            });
            for (const member of members) {
                emitToUser(io, member.userId, 'message_deleted', deletePayload);
            }
        } else if (activeChatId?.startsWith('user_')) {
            const receiverId = parseInt(activeChatId.replace('user_', ''), 10);
            io.to(activeChatId).emit('message_deleted', deletePayload);
            socket.emit('message_deleted', deletePayload);
            emitToUser(io, receiverId, 'message_deleted', deletePayload);
        }

        console.log(` [delete_message] Сообщение ${messageId} удалено`);
    } catch (err) {
        console.error(' Ошибка delete_message:', err);
    }
});

        // === ПРОЧТЕНИЕ СООБЩЕНИЙ 
        socket.on('read_messages', async ({ activeChatId }) => {
            if (!activeChatId) return;
            const myId = socket.userId;

            if (activeChatId === 'chat_general' || activeChatId === 'null') return;

            let type, id;
            if (activeChatId.startsWith('channel_')) {
                type = 'channel';
                id = parseInt(activeChatId.replace('channel_', ''), 10);
            } else if (activeChatId.startsWith('chat_')) {
                type = 'chat';
                id = parseInt(activeChatId.replace('chat_', ''), 10);
            } else if (activeChatId.startsWith('user_')) {
                type = 'private';
                id = parseInt(activeChatId.replace('user_', ''), 10);
            } else return;
            if (isNaN(id)) return;

            try {
                if (type === 'chat') {
                    const member = await prisma.chatMember.findUnique({
                        where: { chatId_userId: { chatId: id, userId: myId } },
                    });
                    if (!member) {
                        console.warn(`🚫 read_messages: не участник chat_${id}`);
                        return;
                    }
                    await prisma.chatMember.update({
                        where: { chatId_userId: { chatId: id, userId: myId } },
                        data: { lastReadAt: new Date() },
                    });
                    await prisma.message.updateMany({
                        where: { chatId: id, senderId: { not: myId }, status: 'unread' },
                        data: { status: 'read' }
                    });
                    io.to(`chat_${id}`).emit('messages_read_update', {
                        activeChatId: `chat_${id}`,
                        readerId: myId
                    });
                } else if (type === 'channel') {
                    const member = await prisma.channelMember.findFirst({
                        where: { channelId: id, userId: myId }
                    });
                    if (!member) {
                        console.warn(`🚫 read_messages: не участник channel_${id}`);
                        return;
                    }
                    await prisma.channelMember.update({
                        where: { id: member.id },
                        data: { lastReadAt: new Date() }
                    });
                    await prisma.message.updateMany({
                        where: { channelId: id, senderId: { not: myId }, status: 'unread' },
                        data: { status: 'read' }
                    });
                    io.to(`channel_${id}`).emit('messages_read_update', {
                        activeChatId: `channel_${id}`,
                        readerId: myId
                    });
                } else if (type === 'private') {
                    await prisma.privateChatMember.upsert({
                        where: { userId_otherUserId: { userId: myId, otherUserId: id } },
                        update: { lastReadAt: new Date() },
                        create: { userId: myId, otherUserId: id, lastReadAt: new Date() }
                    });
                    await prisma.message.updateMany({
                        where: {
                            senderId: id,
                            receiverId: myId,
                            channelId: null,
                            chatId: null,
                            status: { not: 'read' }
                        },
                        data: { status: 'read' }
                    });
                    emitToUser(io, id, 'messages_read_update', {
                            activeChatId: `user_${myId}`,
                            readerId: myId
                        });
                }
            } catch (err) {
                console.error(' Ошибка read_messages:', err);
            }
        });

        // === ПЕЧАТАНИЕ ===
        socket.on('typing', (data) => {
            if (!data || !data.activeChatId) return;
            const { activeChatId } = data;
            const senderId = socket.userId;

            if (activeChatId === 'chat_general') {
                socket.to('chat_general').emit('typing', { senderId, isGeneral: true, activeChatId });
            } else if (activeChatId.startsWith('channel_') || activeChatId.startsWith('chat_')) {
                socket.to(activeChatId).emit('typing', { senderId, isGeneral: false, activeChatId });
            } else if (activeChatId.startsWith('user_')) {
                const targetUserId = parseInt(activeChatId.replace('user_', ''), 10);
                if (!isNaN(targetUserId)) {
                    emitToUser(io, targetUserId, 'typing', {
                            senderId,
                            isGeneral: false,
                            activeChatId: `user_${senderId}`
                        });
                }
            }
        });

        socket.on('stop_typing', (data) => {
            if (!data || !data.activeChatId) return;
            const { activeChatId } = data;
            const senderId = socket.userId;
            if (activeChatId === 'chat_general') {
                socket.to('chat_general').emit('stop_typing', { activeChatId });
            } else if (activeChatId.startsWith('channel_') || activeChatId.startsWith('chat_')) {
                socket.to(activeChatId).emit('stop_typing', { activeChatId });
            } else if (activeChatId.startsWith('user_')) {
                const targetUserId = parseInt(activeChatId.replace('user_', ''), 10);
                if (!isNaN(targetUserId)) {
                    emitToUser(io, targetUserId, 'stop_typing', {
                            activeChatId: `user_${senderId}`
                        });
                }
            }
        });

        // === УДАЛЕНИЕ УЧАСТНИКА ===
        socket.on('remove_member', async (data) => {
            const { chatId, userId, chatType } = data;
            console.log(`🗑️ [SERVER] remove_member: chatId=${chatId}, userId=${userId}, chatType=${chatType}`);

            try {
                let cleanId, roomName;
                if (chatId.startsWith('chat_')) {
                    cleanId = parseInt(chatId.replace('chat_', ''), 10);
                    roomName = `chat_${cleanId}`;
                } else if (chatId.startsWith('channel_')) {
                    cleanId = parseInt(chatId.replace('channel_', ''), 10);
                    roomName = `channel_${cleanId}`;
                } else return;

                if (chatType === 'group') {
                    const chat = await prisma.chat.findUnique({ where: { id: cleanId } });
                    if (!chat) return;
                    if (chat.creatorId !== currentUserId && Number(userId) !== currentUserId) {
                        console.warn('🚫 remove_member: нет прав');
                        return;
                    }
                    if (Number(userId) === chat.creatorId) return;

                    const member = await prisma.chatMember.findUnique({
                        where: { chatId_userId: { chatId: cleanId, userId } }
                    });
                    if (!member) return;
                    await prisma.chatMember.delete({
                        where: { chatId_userId: { chatId: cleanId, userId } }
                    });
                    io.to(roomName).emit('chat_member_removed', {
                        chatId: cleanId,
                        userId,
                        chatName: chat.name || 'Групповой чат'
                    });
                    emitToUser(io, userId, 'chat_member_removed', {
                            chatId: cleanId,
                            userId,
                            chatName: chat.name || 'Групповой чат'
                        });
                    leaveUserFromRoom(io, userId, roomName);
                } else if (chatType === 'channel') {
                    const channel = await prisma.channel.findUnique({ where: { id: cleanId } });
                    if (!channel) return;
                    const admin = await prisma.channelMember.findFirst({
                        where: { channelId: cleanId, userId: currentUserId, role: 'admin' },
                    });
                    const canKick = channel.creatorId === currentUserId || admin;
                    const isSelfLeave = Number(userId) === currentUserId;
                    if (!canKick && !isSelfLeave) {
                        console.warn('🚫 remove_member channel: нет прав');
                        return;
                    }
                    if (Number(userId) === channel.creatorId) return;

                    const member = await prisma.channelMember.findFirst({
                        where: { channelId: cleanId, userId: Number(userId) }
                    });
                    if (!member) return;
                    await prisma.channelMember.delete({ where: { id: member.id } });
                    io.to(roomName).emit('channel_member_removed', {
                        channelId: cleanId,
                        userId,
                        channelName: channel.name || 'Канал'
                    });
                    emitToUser(io, userId, 'kicked_from_channel', {
                            channelId: cleanId,
                            channelName: channel.name || 'Канал'
                        });
                    leaveUserFromRoom(io, userId, roomName);
                }
            } catch (err) {
                console.error('❌ Ошибка remove_member:', err);
            }
        });

        // === ДОБАВЛЕНИЕ УЧАСТНИКА ===
        socket.on('add_member', async (data) => {
            const { chatId, userId, chatType } = data;
            console.log(`➕ [SERVER] add_member: chatId=${chatId}, userId=${userId}, chatType=${chatType}`);

            try {
                let cleanId, roomName;
                if (chatId.startsWith('chat_')) {
                    cleanId = parseInt(chatId.replace('chat_', ''), 10);
                    roomName = `chat_${cleanId}`;
                } else if (chatId.startsWith('channel_')) {
                    cleanId = parseInt(chatId.replace('channel_', ''), 10);
                    roomName = `channel_${cleanId}`;
                } else return;

                if (chatType === 'group') {
                    const chat = await prisma.chat.findUnique({ where: { id: cleanId } });
                    if (!chat) return;
                    if (chat.creatorId !== currentUserId) {
                        const me = await prisma.chatMember.findUnique({
                            where: { chatId_userId: { chatId: cleanId, userId: currentUserId } },
                        });
                        if (!me) {
                            console.warn('🚫 add_member: нет прав');
                            return;
                        }
                    }
                    const existing = await prisma.chatMember.findUnique({
                        where: { chatId_userId: { chatId: cleanId, userId } }
                    });
                    if (!existing) {
                        const member = await prisma.chatMember.create({
                            data: { chatId: cleanId, userId },
                            include: { user: { select: { id: true, username: true, avatar: true } } }
                        });
                        const fullChat = await prisma.chat.findUnique({
                            where: { id: cleanId },
                            include: {
                                messages: {
                                    orderBy: { createdAt: 'desc' },
                                    take: 1,
                                    include: { sender: { select: { id: true, username: true } } }
                                },
                                members: {
                                    include: { user: { select: { id: true, username: true, avatar: true } } }
                                }
                            }
                        });
                        const lastMessage = fullChat.messages[0] || null;
                        const chatData = {
                            id: cleanId,
                            name: fullChat.name,
                            avatar: fullChat.avatar,
                            creatorId: fullChat.creatorId,
                            members: fullChat.members,
                            lastMessage,
                            type: 'group'
                        };
                        io.to(roomName).emit('chat_member_added', {
                            chatId: cleanId,
                            member,
                            chatName: fullChat.name,
                            chatAvatar: fullChat.avatar,
                            lastMessage,
                            chatData
                        });
                        emitToUser(io, userId, 'chat_member_added', {
                                chatId: cleanId,
                                member,
                                chatName: fullChat.name,
                                chatAvatar: fullChat.avatar,
                                lastMessage,
                                chatData
                            });
                        joinUserToRoom(io, userId, roomName);
                    }
                } else if (chatType === 'channel') {
                    const channel = await prisma.channel.findUnique({ where: { id: cleanId } });
                    if (!channel) return;
                    const admin = await prisma.channelMember.findFirst({
                        where: { channelId: cleanId, userId: currentUserId, role: 'admin' },
                    });
                    if (channel.creatorId !== currentUserId && !admin) {
                        console.warn('🚫 add_member channel: нет прав');
                        return;
                    }
                    const existing = await prisma.channelMember.findFirst({
                        where: { channelId: cleanId, userId: Number(userId) }
                    });
                    if (!existing) {
                        const member = await prisma.channelMember.create({
                            data: { channelId: cleanId, userId: Number(userId), role: 'member' },
                            include: { user: { select: { id: true, username: true, avatar: true } } }
                        });
                        const fullChannel = await prisma.channel.findUnique({
                            where: { id: cleanId },
                            include: {
                                messages: {
                                    orderBy: { createdAt: 'desc' },
                                    take: 1,
                                    include: { sender: { select: { id: true, username: true } } }
                                }
                            }
                        });
                        const lastMessage = fullChannel.messages[0] || null;
                        const { messages, ...channelData } = fullChannel;
                        io.to(roomName).emit('channel_member_added', {
                            channelId: cleanId,
                            member,
                            channelName: fullChannel.name
                        });
                        emitToUser(io, userId, 'channel_created', {
                                ...channelData,
                                lastMessage,
                                members: [member]
                            });
                        joinUserToRoom(io, userId, roomName);
                    }
                }
            } catch (err) {
                console.error('❌ Ошибка add_member:', err);
            }
        });

        // === УДАЛЕНИЕ КАНАЛА ===
        socket.on('delete_channel', async ({ channelId }) => {
            try {
                const userId = socket.userId;
                const channel = await prisma.channel.findUnique({ where: { id: channelId } });
                if (!channel || channel.creatorId !== userId) return;
                const members = await prisma.channelMember.findMany({
                    where: { channelId },
                    select: { userId: true },
                });
                await prisma.channel.delete({ where: { id: channelId } });
                for (const m of members) {
                    emitToUser(io, m.userId, 'channel_deleted', { channelId });
                }
            } catch (err) {
                console.error('❌ Ошибка delete_channel:', err);
            }
        });

        // ===  ТРЕДЫ ===
        socket.on('create_thread', async ({ messageId, text, activeChatId }) => {
            try {
                const userId = socket.userId;
                const still = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
                if (!still) {
                    socket.emit('account_deleted', { message: 'Аккаунт удалён' });
                    socket.disconnect(true);
                    return;
                }
                if (!text?.trim()) return;
                const message = await prisma.message.findUnique({ where: { id: messageId } });
                if (!message) return;
                if (message.channelId) {
                    const channel = await prisma.channel.findUnique({
                        where: { id: message.channelId },
                        select: { commentsEnabled: true },
                    });
                    if (channel && channel.commentsEnabled === false) {
                        socket.emit('error', { message: 'Комментарии в канале отключены' });
                        return;
                    }
                    const member = await prisma.channelMember.findFirst({
                        where: { channelId: message.channelId, userId },
                    });
                    if (!member) {
                        socket.emit('error', { message: 'Вы не участник канала' });
                        return;
                    }
                }
                const thread = await prisma.thread.create({
                    data: { messageId, userId, text: text.trim() },
                    include: { user: { select: { id: true, username: true, avatar: true } } }
                });
                io.to(activeChatId || 'chat_general').emit('thread_created', {
                    thread,
                    messageId,
                    activeChatId
                });
            } catch (err) {
                console.error('❌ Ошибка create_thread:', err);
            }
        });

        // ===  РЕАКЦИИ ===
        socket.on('toggle_reaction', async ({ messageId, type, activeChatId }) => {
            try {
                const userId = socket.userId;
                if (!type) return;
                const existing = await prisma.reaction.findUnique({
                    where: { messageId_userId: { messageId, userId } }
                });
                if (existing) {
                    await prisma.reaction.delete({
                        where: { messageId_userId: { messageId, userId } }
                    });
                } else {
                    await prisma.reaction.create({
                        data: { messageId, userId, type }
                    });
                }
                const allReactions = await prisma.reaction.findMany({
                    where: { messageId },
                    include: { user: { select: { id: true, username: true } } }
                });
                io.to(activeChatId || 'chat_general').emit('reaction_updated', {
                    messageId,
                    reactions: allReactions
                });
            } catch (err) {
                console.error('❌ Ошибка toggle_reaction:', err);
            }
        });

        // ===  УДАЛЕНИЕ ГРУППЫ ===
        socket.on('delete_group', async ({ chatId }) => {
            try {
                const userId = socket.userId;
                const chat = await prisma.chat.findUnique({ where: { id: chatId } });
                if (!chat || chat.creatorId !== userId) return;
                const members = await prisma.chatMember.findMany({
                    where: { chatId },
                    select: { userId: true },
                });
                await prisma.chat.delete({ where: { id: chatId } });
                for (const m of members) {
                    emitToUser(io, m.userId, 'chat_deleted', { chatId });
                }
            } catch (err) {
                console.error('❌ Ошибка delete_group:', err);
            }
        });

        // === ОБНОВЛЕНИЕ КАНАЛА/ГРУППЫ (только создатель/админ) ===
        socket.on('channel_updated', async (data) => {
            try {
                const channelId = parseInt(data?.channelId ?? data?.id, 10);
                if (isNaN(channelId)) return;

                const channel = await prisma.channel.findUnique({ where: { id: channelId } });
                if (!channel) return;

                const admin = await prisma.channelMember.findFirst({
                    where: { channelId, userId: currentUserId, role: 'admin' },
                });
                if (channel.creatorId !== currentUserId && !admin) {
                    console.warn(`🚫 channel_updated denied user=${currentUserId}`);
                    return;
                }

                const { channelId: _c, ...updateData } = data;
                io.to(`channel_${channelId}`).emit('channel_updated', {
                    ...updateData,
                    id: channelId,
                });
            } catch (err) {
                console.error('channel_updated error:', err.message);
            }
        });

        socket.on('chat_updated', async (data) => {
            try {
                const chatId = parseInt(data?.chatId ?? data?.id, 10);
                if (isNaN(chatId)) return;

                const chat = await prisma.chat.findUnique({ where: { id: chatId } });
                if (!chat || chat.creatorId !== currentUserId) {
                    console.warn(`🚫 chat_updated denied user=${currentUserId}`);
                    return;
                }

                const { chatId: _c, ...updateData } = data;
                io.to(`chat_${chatId}`).emit('chat_updated', {
                    ...updateData,
                    id: chatId,
                });
            } catch (err) {
                console.error('chat_updated error:', err.message);
            }
        });

        // === ОТКЛЮЧЕНИЕ ===
        socket.on('disconnect', () => {
            const userId = socket.userId;
            console.log(`🔌 Пользователь ${userId} отключился (${socket.id})`);
            const wentOffline = removeOnlineUser(userId, socket.id);
            if (wentOffline) {
                io.emit('user_status_change', { userId, status: 'offline' });
            }
        });
    });
};

module.exports = {
    setupSocket,
    onlineUsers,
    emitToUser,
    getOnlineSockets,
    joinUserToRoom,
    leaveUserFromRoom,
    isUserOnline,
};