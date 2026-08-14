const prisma = require('../lib/prisma');

/**
 * Проверяет, может ли userId читать/писать в activeChatId.
 * @returns {{ ok: boolean, error?: string, status?: number, chatId?: number, channelId?: number, peerId?: number }}
 */
async function assertChatAccess(userId, activeChatId, { requireAdmin = false } = {}) {
    if (!activeChatId || typeof activeChatId !== 'string') {
        return { ok: false, status: 400, error: 'Невалидный activeChatId' };
    }

    if (activeChatId === 'chat_general') {
        // Общий лобби-чат больше не отдаёт все group-сообщения
        return { ok: false, status: 403, error: 'Доступ к chat_general закрыт' };
    }

    if (activeChatId.startsWith('channel_')) {
        const channelId = parseInt(activeChatId.replace('channel_', ''), 10);
        if (isNaN(channelId)) return { ok: false, status: 400, error: 'Невалидный ID канала' };

        const member = await prisma.channelMember.findFirst({
            where: { channelId, userId },
        });
        if (!member) return { ok: false, status: 403, error: 'Вы не участник канала' };
        if (requireAdmin && member.role !== 'admin') {
            const channel = await prisma.channel.findUnique({ where: { id: channelId } });
            if (channel?.creatorId !== userId) {
                return { ok: false, status: 403, error: 'Нужны права админа' };
            }
        }
        return { ok: true, channelId, role: member.role };
    }

    if (activeChatId.startsWith('chat_')) {
        const chatId = parseInt(activeChatId.replace('chat_', ''), 10);
        if (isNaN(chatId)) return { ok: false, status: 400, error: 'Невалидный ID чата' };

        const member = await prisma.chatMember.findUnique({
            where: { chatId_userId: { chatId, userId } },
        });
        if (!member) return { ok: false, status: 403, error: 'Вы не участник группы' };

        if (requireAdmin) {
            const chat = await prisma.chat.findUnique({ where: { id: chatId } });
            if (chat?.creatorId !== userId) {
                return { ok: false, status: 403, error: 'Только создатель может это сделать' };
            }
        }
        return { ok: true, chatId };
    }

    if (activeChatId.startsWith('user_')) {
        const peerId = parseInt(activeChatId.replace('user_', ''), 10);
        if (isNaN(peerId)) return { ok: false, status: 400, error: 'Невалидный ID пользователя' };
        if (peerId === userId) return { ok: false, status: 400, error: 'Нельзя открыть чат с собой' };
        // Приватные: достаточно auth; контакт не обязателен (можно ужесточить позже)
        return { ok: true, peerId };
    }

    return { ok: false, status: 400, error: 'Неизвестный формат чата' };
}

async function isChatMember(userId, chatId) {
    const m = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: Number(chatId), userId: Number(userId) } },
    });
    return Boolean(m);
}

async function isChannelMember(userId, channelId) {
    const m = await prisma.channelMember.findFirst({
        where: { channelId: Number(channelId), userId: Number(userId) },
    });
    return Boolean(m);
}

module.exports = {
    assertChatAccess,
    isChatMember,
    isChannelMember,
};
