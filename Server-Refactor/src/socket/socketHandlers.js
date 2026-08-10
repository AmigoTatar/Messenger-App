
const jwt = require('jsonwebtoken');

// Глобальное хранилище онлайн-пользователей
const onlineUsers = new Map();

const setupSocket = (io, prisma) => {
    // === АУТЕНТИФИКАЦИЯ 
    io.use((socket, next) => {
        const token = (socket.handshake.auth && socket.handshake.auth.token) ||
            (socket.handshake.headers['authorization'] && socket.handshake.headers['authorization'].split(' ')[1]);

        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) return next(new Error('Authentication error: Invalid token'));
            socket.userId = Number(decoded.userId);
            next();
        });
    });

    io.on('connection', (socket) => {
        const currentUserId = socket.userId;
        console.log(`📡 Пользователь ${currentUserId} подключился: ${socket.id}`);

        onlineUsers.set(currentUserId, socket.id);
        io.emit('user_status_change', { userId: currentUserId, status: 'online' });

        // ===  ПРИСОЕДИНЕНИЕ К КОМНАТЕ ===
        socket.on('join_chat', (chatId) => {
            if (!chatId) return;
            socket.join(String(chatId));
            console.log(`🚪 Сокет ${socket.id} (юзер ${currentUserId}) в комнате: ${chatId}`);
        });

        // ===  ОТПРАВКА СООБЩЕНИЯ ===
        socket.on('send_message', async (messageData) => {
            try {
                console.log(' [send_message] START от', currentUserId, messageData);

                const { text, mediaUrl, mediaType, activeChatId, isForwarded } = messageData;
                if (!text && !mediaUrl) return;
                if (text && text.length > 10000) return;
                if (!activeChatId) return;

                const senderId = currentUserId;
                let receiverId = null;
                let channelId = null;
                let chatId = null;

                // Определяем тип чата
                if (activeChatId.startsWith('user_')) {
                    receiverId = parseInt(activeChatId.replace('user_', ''), 10);
                    if (isNaN(receiverId)) return;
                    console.log(`📨 [send_message] Приватный чат с ${receiverId}`);
                } else if (activeChatId.startsWith('channel_')) {
                    channelId = parseInt(activeChatId.replace('channel_', ''), 10);
                    if (isNaN(channelId)) return;
                    console.log(`📨 [send_message] Канал ${channelId}`);
                    const member = await prisma.channelMember.findFirst({
                        where: { channelId, userId: senderId }
                    });
                    if (!member) {
                        socket.emit('error', { message: 'Вы не участник канала' });
                        return;
                    }
                    if (member.role !== 'admin') {
                        socket.emit('error', { message: 'Только администраторы могут писать в канал' });
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
                console.log('📨 [send_message] Попытка сохранить в БД:', { senderId, receiverId, channelId, chatId, text });
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
                        status: 'unread'
                    },
                    include: {
                        sender: { select: { id: true, username: true } }
                    }
                });

                console.log(`[send_message] Сохранено сообщение ${savedMessage.id}`);

                // ====== PUSH-УВЕДОМЛЕНИЯ ======
try {
    const { sendPush } = require('../services/pushService');
      console.log('🔍 [PUSH] Проверка получателей...');
    console.log('🔍 receiverId:', receiverId);
    console.log('🔍 chatId:', chatId);
    console.log('🔍 channelId:', channelId);

    if (receiverId) {
        const tokens = await prisma.pushToken.findMany({
            where: { userId: receiverId, isActive: true }
        });
        for (const t of tokens) {
            await sendPush(t.token, 'Новое сообщение', text || '📎 Файл');
        }
    }

    if (chatId) {
        const members = await prisma.chatMember.findMany({
            where: { chatId, userId: { not: senderId } },
            include: { user: { include: { pushTokens: true } } }
        });
        for (const m of members) {
            for (const t of m.user.pushTokens) {
                await sendPush(t.token, `Новое в чате ${m.user.username}`, text || '📎 Файл');
            }
        }
    }

    if (channelId) {
        const members = await prisma.channelMember.findMany({
            where: { channelId, userId: { not: senderId } },
            include: { user: { include: { pushTokens: true } } }
        });
        for (const m of members) {
            for (const t of m.user.pushTokens) {
                await sendPush(t.token, `Новое в канале`, text || '📎 Файл');
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
                    isForwarded: savedMessage.isForwarded || false
                };

                // === РАССЫЛКА ===
                if (chatId) {
                    io.to(`chat_${chatId}`).emit('receive_message', newMessage);
                    const members = await prisma.chatMember.findMany({
                        where: { chatId },
                        select: { userId: true }
                    });
                    for (const member of members) {
                        const socketId = onlineUsers.get(member.userId);
                        if (socketId && member.userId !== senderId) {
                            io.to(socketId).emit('receive_message', newMessage);
                            io.to(socketId).emit('chat_updated', {
                                chatId,
                                lastMessage: newMessage
                            });
                            const unreadCount = await prisma.message.count({
                                where: {
                                    chatId,
                                    senderId: { not: member.userId },
                                    status: 'unread'
                                }
                            });
                            io.to(socketId).emit('unread_updated', {
                                type: 'chat',
                                id: chatId,
                                count: unreadCount
                            });
                        }
                    }
                } else if (channelId) {
                    io.to(`channel_${channelId}`).emit('receive_message', newMessage);
                    const members = await prisma.channelMember.findMany({
                        where: { channelId },
                        select: { userId: true }
                    });
                    for (const member of members) {
                        const socketId = onlineUsers.get(member.userId);
                        if (socketId && member.userId !== senderId) {
                            io.to(socketId).emit('receive_message', newMessage);
                            io.to(socketId).emit('channel_updated', {
                                channelId,
                                lastMessage: newMessage
                            });
                            const unreadCount = await prisma.message.count({
                                where: {
                                    channelId,
                                    senderId: { not: member.userId },
                                    status: 'unread'
                                }
                            });
                            io.to(socketId).emit('unread_updated', {
                                type: 'channel',
                                id: channelId,
                                count: unreadCount
                            });
                        }
                    }
                } else if (receiverId) {
                    socket.emit('receive_message', newMessage);
                    const targetSocketId = onlineUsers.get(receiverId);
                    if (targetSocketId) {
                        io.to(targetSocketId).emit('receive_message', newMessage);
                        const unreadCount = await prisma.message.count({
                            where: {
                                senderId: senderId,
                                receiverId: receiverId,
                                channelId: null,
                                chatId: null,
                                status: 'unread'
                            }
                        });
                        io.to(targetSocketId).emit('unread_updated', {
                            type: 'private',
                            id: senderId,
                            count: unreadCount
                        });
                    }
                }

                console.log(`✅ [send_message] Сообщение ${savedMessage.id} разослано`);
            } catch (error) {
                console.error('❌ [send_message] Ошибка:', error);
                console.error('❌ [send_message] Стек:', error.stack);
            }
        });

 // ===  УДАЛЕНИЕ СООБЩЕНИЯ 
socket.on('delete_message', async ({ messageId, activeChatId }) => {
    try {
        console.log(` [delete_message] messageId: ${messageId}, activeChatId: ${activeChatId}`);

        const message = await prisma.message.findUnique({
            where: { id: Number(messageId) },
            include: {
                sender: { select: { id: true, username: true } }
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
                const socketId = onlineUsers.get(member.userId);
                if (socketId) {
                    io.to(socketId).emit('message_deleted', deletePayload);
                }
            }
        } else if (activeChatId?.startsWith('chat_')) {
            const chatId = parseInt(activeChatId.replace('chat_', ''), 10);
            io.to(`chat_${chatId}`).emit('message_deleted', deletePayload);
            const members = await prisma.chatMember.findMany({
                where: { chatId },
                select: { userId: true }
            });
            for (const member of members) {
                const socketId = onlineUsers.get(member.userId);
                if (socketId) {
                    io.to(socketId).emit('message_deleted', deletePayload);
                }
            }
        } else if (activeChatId?.startsWith('user_')) {
            const receiverId = parseInt(activeChatId.replace('user_', ''), 10);
            io.to(activeChatId).emit('message_deleted', deletePayload);
            socket.emit('message_deleted', deletePayload);
            const targetSocketId = onlineUsers.get(receiverId);
            if (targetSocketId) {
                io.to(targetSocketId).emit('message_deleted', deletePayload);
            }
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
            console.log(`👁️ Юзер ${myId} прочитал ${activeChatId}`);

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
                    await prisma.chatMember.upsert({
                        where: { chatId_userId: { chatId: id, userId: myId } },
                        update: { lastReadAt: new Date() },
                        create: { chatId: id, userId: myId, lastReadAt: new Date() }
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
                        await prisma.channelMember.create({
                            data: { channelId: id, userId: myId, role: 'member', lastReadAt: new Date() }
                        });
                    } else {
                        await prisma.channelMember.update({
                            where: { id: member.id },
                            data: { lastReadAt: new Date() }
                        });
                    }
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
                    const targetSocketId = onlineUsers.get(id);
                    if (targetSocketId) {
                        io.to(targetSocketId).emit('messages_read_update', {
                            activeChatId: `user_${myId}`,
                            readerId: myId
                        });
                    }
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
            console.log(`📝 Печатает ${senderId} в ${activeChatId}`);

            if (activeChatId === 'chat_general') {
                socket.to('chat_general').emit('typing', { senderId, isGeneral: true, activeChatId });
            } else if (activeChatId.startsWith('channel_') || activeChatId.startsWith('chat_')) {
                socket.to(activeChatId).emit('typing', { senderId, isGeneral: false, activeChatId });
            } else if (activeChatId.startsWith('user_')) {
                const targetUserId = parseInt(activeChatId.replace('user_', ''), 10);
                if (!isNaN(targetUserId)) {
                    const targetSocketId = onlineUsers.get(targetUserId);
                    if (targetSocketId) {
                        io.to(targetSocketId).emit('typing', {
                            senderId,
                            isGeneral: false,
                            activeChatId: `user_${senderId}`
                        });
                    }
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
                    const targetSocketId = onlineUsers.get(targetUserId);
                    if (targetSocketId) {
                        io.to(targetSocketId).emit('stop_typing', {
                            activeChatId: `user_${senderId}`
                        });
                    }
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
                        chatName: 'Групповой чат'
                    });
                    const removedUserSocketId = onlineUsers.get(userId);
                    if (removedUserSocketId) {
                        io.to(removedUserSocketId).emit('chat_member_removed', {
                            chatId: cleanId,
                            userId,
                            chatName: 'Групповой чат'
                        });
                    }
                } else if (chatType === 'channel') {
                    const member = await prisma.channelMember.findUnique({
                        where: { channelId_userId: { channelId: cleanId, userId } }
                    });
                    if (!member) return;
                    await prisma.channelMember.delete({
                        where: { channelId_userId: { channelId: cleanId, userId } }
                    });
                    io.to(roomName).emit('channel_member_removed', {
                        channelId: cleanId,
                        userId,
                        channelName: 'Канал'
                    });
                    const removedUserSocketId = onlineUsers.get(userId);
                    if (removedUserSocketId) {
                        io.to(removedUserSocketId).emit('kicked_from_channel', {
                            channelId: cleanId,
                            channelName: 'Канал'
                        });
                    }
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
                        const newUserSocketId = onlineUsers.get(userId);
                        if (newUserSocketId) {
                            io.to(newUserSocketId).emit('chat_member_added', {
                                chatId: cleanId,
                                member,
                                chatName: fullChat.name,
                                chatAvatar: fullChat.avatar,
                                lastMessage,
                                chatData
                            });
                        }
                    }
                } else if (chatType === 'channel') {
                    const existing = await prisma.channelMember.findUnique({
                        where: { channelId_userId: { channelId: cleanId, userId } }
                    });
                    if (!existing) {
                        const member = await prisma.channelMember.create({
                            data: { channelId: cleanId, userId, role: 'member' },
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
                        const newUserSocketId = onlineUsers.get(userId);
                        if (newUserSocketId) {
                            io.to(newUserSocketId).emit('channel_created', {
                                ...channelData,
                                lastMessage,
                                members: [member]
                            });
                        }
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
                await prisma.channel.delete({ where: { id: channelId } });
                io.emit('channel_deleted', { channelId });
            } catch (err) {
                console.error('❌ Ошибка delete_channel:', err);
            }
        });

        // ===  ТРЕДЫ ===
        socket.on('create_thread', async ({ messageId, text, activeChatId }) => {
            try {
                const userId = socket.userId;
                if (!text?.trim()) return;
                const message = await prisma.message.findUnique({ where: { id: messageId } });
                if (!message) return;
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
                await prisma.chat.delete({ where: { id: chatId } });
                io.emit('chat_deleted', { chatId });
            } catch (err) {
                console.error('❌ Ошибка delete_group:', err);
            }
        });

        // === 1 ОБНОВЛЕНИЕ КАНАЛА/ГРУППЫ (добавляем новые события) ===
        socket.on('channel_updated', async (data) => {
            
            const { channelId, ...updateData } = data;
            io.to(`channel_${channelId}`).emit('channel_updated', updateData);
        });

        socket.on('chat_updated', async (data) => {
            
            const { chatId, ...updateData } = data;
            io.to(`chat_${chatId}`).emit('chat_updated', updateData);
        });

        // === 13. ОТКЛЮЧЕНИЕ ===
        socket.on('disconnect', () => {
            const userId = socket.userId;
            console.log(`🔌 Пользователь ${userId} отключился`);
            if (userId && onlineUsers.get(userId) === socket.id) {
                onlineUsers.delete(userId);
                io.emit('user_status_change', { userId, status: 'offline' });
            }
        });
    });
};

module.exports = { setupSocket, onlineUsers };