const prisma = require('../lib/prisma');
const { emitToUser } = require('../utils/onlineUsers');
const { assertChatAccess } = require('../utils/chatAccess');


// ПОЛУЧЕНИЕ СООБЩЕНИЙ (с пагинацией)

const getMessages = async (req, res) => {
    try {
        const { activeChatId, cursorMessageId } = req.query;
        const currentUserId = req.userId;

        if (!activeChatId) {
            return res.status(400).json({ error: "Параметр activeChatId обязателен" });
        }

        const access = await assertChatAccess(currentUserId, activeChatId);
        if (!access.ok) {
            return res.status(access.status || 403).json({ error: access.error });
        }

        const limit = 30;
        let whereClause = {};

        if (activeChatId.startsWith('channel_')) {
            whereClause = { channelId: access.channelId };
        } else if (activeChatId.startsWith('user_')) {
            whereClause = {
                channelId: null,
                chatId: null,
                OR: [
                    { senderId: currentUserId, receiverId: access.peerId },
                    { senderId: access.peerId, receiverId: currentUserId }
                ]
            };
        } else if (activeChatId.startsWith('chat_')) {
            whereClause = {
                chatId: access.chatId
            };
        } else {
            return res.status(400).json({ error: "Неизвестный формат чата" });
        }

        let queryOptions = {
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                sender: { select: { id: true, username: true } },
                threads: {
                    include: { user: { select: { id: true, username: true, avatar: true } } },
                    orderBy: { createdAt: 'asc' }
                },
                reactions: {
                    include: { user: { select: { id: true, username: true } } }
                }
            }
        };

        if (cursorMessageId) {
            const cursorId = Number(cursorMessageId);
            if (!isNaN(cursorId)) {
                queryOptions.cursor = { id: cursorId };
                queryOptions.skip = 1;
            }
        }

        const messages = await prisma.message.findMany(queryOptions);
        const orderedMessages = messages.reverse();

        return res.json({
            messages: orderedMessages,
            hasMore: messages.length === limit
        });
    } catch (error) {
        console.error('Ошибка при получении сообщений:', error);
        return res.status(500).json({ error: 'Ошибка сервера при загрузке истории чата' });
    }
};


// ПОЛУЧЕНИЕ ЗАКРЕПЛЁННЫХ

const getPinnedMessages = async (req, res) => {
    try {
        const { channelId, chatId, privateUserId } = req.query;
        const userId = req.userId;

        let where = { isPinned: true, isDeleted: false };
        let activeChatId = null;

        if (channelId) {
            activeChatId = `channel_${channelId}`;
            where.channelId = parseInt(channelId);
        } else if (chatId) {
            activeChatId = `chat_${chatId}`;
            where.chatId = parseInt(chatId);
        } else if (privateUserId) {
            const otherUserId = parseInt(privateUserId.toString().replace(/\D/g, ''));
            activeChatId = `user_${otherUserId}`;
            where.OR = [
                { senderId: userId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: userId }
            ];
            where.channelId = null;
            where.chatId = null;
        } else {
            return res.status(400).json({ error: 'Не указан channelId, chatId или privateUserId' });
        }

        const access = await assertChatAccess(userId, activeChatId);
        if (!access.ok) {
            return res.status(access.status || 403).json({ error: access.error });
        }

        const pinnedMessages = await prisma.message.findMany({
            where,
            include: {
                sender: { select: { id: true, username: true, avatar: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json(pinnedMessages);
    } catch (error) {
        console.error('❌ Ошибка получения закрепленных:', error);
        res.status(500).json({ error: 'Ошибка получения закрепленных сообщений' });
    }
};


// ПЕРЕКЛЮЧЕНИЕ ЗАКРЕПЛЕНИЯ

const togglePin = async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);
        const userId = req.userId;

        const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
                chat: true,
                channel: true,
                sender: { select: { id: true, username: true, avatar: true } }
            }
        });

        if (!message) {
            return res.status(404).json({ error: 'Сообщение не найдено' });
        }

        let canPin = false;

        if (message.senderId === userId) canPin = true;

        if (!canPin && message.channelId) {
            const channel = await prisma.channel.findUnique({ where: { id: message.channelId } });
            if (channel && channel.creatorId === userId) canPin = true;
            if (!canPin) {
                const isAdmin = await prisma.channelMember.findFirst({
                    where: { channelId: message.channelId, userId, role: 'admin' }
                });
                if (isAdmin) canPin = true;
            }
        }

        if (!canPin && message.chatId) {
            const chat = await prisma.chat.findUnique({ where: { id: message.chatId } });
            if (chat && chat.creatorId === userId) canPin = true;
        }

        if (!canPin) {
            return res.status(403).json({ error: 'Нет прав на закрепление' });
        }

        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: { isPinned: !message.isPinned },
            include: {
                sender: { select: { id: true, username: true, avatar: true } }
            }
        });

        // Отправка через сокет
        const io = req.app.get('io');
        let roomName = null;
        if (message.channelId) {
            roomName = `channel_${message.channelId}`;
        } else if (message.chatId) {
            roomName = `chat_${message.chatId}`;
        } else if (message.receiverId) {
            // Приватный чат: отправляем обоим на все устройства
            const pinPayload = {
                messageId: updatedMessage.id,
                isPinned: updatedMessage.isPinned,
                message: updatedMessage
            };
            emitToUser(io, message.senderId, 'message_pinned', pinPayload);
            emitToUser(io, message.receiverId, 'message_pinned', pinPayload);
            // Для приватных чатов также отправляем в комнату user_... (если есть)
            roomName = `user_${message.receiverId}`;
        }

        if (roomName) {
            io.to(roomName).emit('message_pinned', {
                messageId: updatedMessage.id,
                isPinned: updatedMessage.isPinned,
                message: updatedMessage
            });
        }

        res.json({ success: true, isPinned: updatedMessage.isPinned, message: updatedMessage });
    } catch (error) {
        console.error('❌ Ошибка закрепления:', error);
        res.status(500).json({ error: 'Не удалось закрепить сообщение' });
    }
};


// РЕДАКТИРОВАНИЕ СООБЩЕНИЯ

const editMessage = async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const userId = req.userId;
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Текст сообщения обязателен' });
        }

        const message = await prisma.message.findUnique({
            where: { id: messageId }
        });

        if (!message) {
            return res.status(404).json({ error: 'Сообщение не найдено' });
        }

        if (message.senderId !== userId) {
            return res.status(403).json({ error: 'Вы не можете редактировать это сообщение' });
        }

        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
                text: text.trim(),
                edited: true
            },
            include: {
                sender: { select: { id: true, username: true, avatar: true } }
            }
        });

        // Отправка через сокет
        const io = req.app.get('io');
        let roomName = null;
        if (message.channelId) {
            roomName = `channel_${message.channelId}`;
        } else if (message.chatId) {
            roomName = `chat_${message.chatId}`;
        } else if (message.receiverId) {
            roomName = `user_${message.receiverId}`;
        }

        if (roomName) {
            io.to(roomName).emit('message_edited', {
                messageId: updatedMessage.id,
                text: updatedMessage.text,
                edited: updatedMessage.edited
            });
        }

        res.json({ success: true, message: updatedMessage });
    } catch (error) {
        console.error('❌ Ошибка редактирования:', error);
        res.status(500).json({ error: 'Не удалось отредактировать1 сообщение' });
    }
};


// РЕАКЦИИ

const toggleReaction = async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);
        const userId = req.userId;
        const { type } = req.body;

        if (!type) {
            return res.status(400).json({ error: 'Тип реакции обязателен' });
        }

        const existingReaction = await prisma.reaction.findUnique({
            where: {
                messageId_userId: {
                    messageId: messageId,
                    userId: userId
                }
            }
        });

        let reaction;
        let action;

        if (existingReaction) {
            await prisma.reaction.delete({
                where: {
                    messageId_userId: {
                        messageId: messageId,
                        userId: userId
                    }
                }
            });
            action = 'removed';
            reaction = null;
        } else {
            reaction = await prisma.reaction.create({
                data: {
                    messageId: messageId,
                    userId: userId,
                    type: type
                },
                include: {
                    user: { select: { id: true, username: true } }
                }
            });
            action = 'added';
        }

        const allReactions = await prisma.reaction.findMany({
            where: { messageId: messageId },
            include: {
                user: { select: { id: true, username: true } }
            }
        });

        const io = req.app.get('io');
        const message = await prisma.message.findUnique({
            where: { id: messageId },
            select: { channelId: true, chatId: true, receiverId: true, senderId: true }
        });

        let roomName = null;
        if (message?.channelId) {
            roomName = `channel_${message.channelId}`;
        } else if (message?.chatId) {
            roomName = `chat_${message.chatId}`;
        } else if (message?.receiverId) {
            roomName = `user_${message.receiverId}`;
        }

        if (roomName) {
            io.to(roomName).emit('reaction_updated', {
                messageId,
                reactions: allReactions,
                action,
                reaction
            });
        } else {
            io.emit('reaction_updated', {
                messageId,
                reactions: allReactions,
                action,
                reaction
            });
        }

        res.json({
            success: true,
            action,
            reaction,
            reactions: allReactions
        });
    } catch (error) {
        console.error('Ошибка при работе с реакцией:', error);
        res.status(500).json({ error: 'Не удалось обработать реакцию' });
    }
};

// ПОИСК СООБЩЕНИЙ

const searchMessages = async (req, res) => {
    try {
        const userId = req.userId;
        const { query, chatType } = req.query;

        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Поисковый запрос должен содержать минимум 2 символа' });
        }

        console.log(`🔍 Поиск: userId=${userId}, query="${query}"`);

        // Получаем все чаты, каналы и приватные диалоги пользователя
        const userChats = await prisma.chatMember.findMany({
            where: { userId },
            select: { chatId: true }
        });

        const userChannels = await prisma.channelMember.findMany({
            where: { userId },
            select: { channelId: true }
        });

        const userPrivateChats = await prisma.privateChatMember.findMany({
            where: { userId },
            select: { otherUserId: true }
        });

        const chatIds = userChats.map(c => c.chatId);
        const channelIds = userChannels.map(c => c.channelId);
        const privateUserIds = userPrivateChats.map(c => c.otherUserId);

        let whereClause = {
            OR: [{ text: { contains: query } }]
        };

        if (chatType === 'private') {
            whereClause.AND = [
                { channelId: null },
                { chatId: null },
                {
                    OR: [
                        { senderId: userId, receiverId: { in: privateUserIds } },
                        { senderId: { in: privateUserIds }, receiverId: userId },
                    ],
                },
            ];
        } else if (chatType === 'group') {
            whereClause.AND = [
                { chatId: { in: chatIds } },
                { channelId: null }
            ];
        } else if (chatType === 'channel') {
            whereClause.AND = [
                { channelId: { in: channelIds } }
            ];
        } else {
            whereClause.AND = [{
                OR: [
                    {
                        AND: [
                            { channelId: null },
                            { chatId: null },
                            {
                                OR: [
                                    { senderId: userId, receiverId: { in: privateUserIds } },
                                    { senderId: { in: privateUserIds }, receiverId: userId },
                                ],
                            },
                        ],
                    },
                    { chatId: { in: chatIds } },
                    { channelId: { in: channelIds } }
                ]
            }];
        }

        const messages = await prisma.message.findMany({
            where: whereClause,
            include: {
                sender: {
                    select: { id: true, username: true, avatar: true }
                },
                chat: {
                    select: { id: true, name: true, avatar: true }
                },
                channel: {
                    select: { id: true, name: true, avatar: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        const formattedMessages = messages.map(msg => {
            let chatName = '';
            let chatType = '';
            let chatId = '';

            if (msg.chat) {
                chatName = msg.chat.name;
                chatType = 'group';
                chatId = 'chat_' + msg.chat.id;
            } else if (msg.channel) {
                chatName = msg.channel.name;
                chatType = 'channel';
                chatId = 'channel_' + msg.channel.id;
            } else if (msg.receiverId) {
                const isOwn = msg.senderId === userId;
                chatName = isOwn ? 'Вы' : 'Собеседник';
                chatType = 'private';
                chatId = 'user_' + (isOwn ? msg.receiverId : msg.senderId);
            }

            return {
                id: msg.id,
                text: msg.text,
                mediaUrl: msg.mediaUrl,
                mediaType: msg.mediaType,
                createdAt: msg.createdAt,
                chatName: chatName,
                chatType: chatType,
                chatId: chatId,
                sender: msg.sender,
                isPinned: msg.isPinned || false,
                edited: msg.edited || false
            };
        });

        res.json({
            results: formattedMessages,
            total: formattedMessages.length,
            query: query
        });
    } catch (error) {
        console.error('❌ Ошибка поиска:', error);
        res.status(500).json({ error: 'Не удалось выполнить поиск' });
    }
};

module.exports = {
    getMessages,
    getPinnedMessages,
    togglePin,
    editMessage,
    toggleReaction,
    searchMessages
};