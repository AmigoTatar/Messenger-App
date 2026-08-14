const prisma = require('../lib/prisma');

const markRead = async (req, res) => {
    try {
        const userId = req.userId;
        const { type, id } = req.body;

        if (!type || !id) {
            return res.status(400).json({ error: 'Не указан type или id' });
        }

        console.log(`📖 Отметка о прочтении: type=${type}, id=${id}, userId=${userId}`);

        if (type === 'chat') {
            const chatId = parseInt(id);
            const chatExists = await prisma.chat.findUnique({ where: { id: chatId } });
            if (!chatExists) {
                return res.status(404).json({ error: 'Чат не найден' });
            }

            // Нельзя «вступить» через mark-read — только если уже участник
            const existingMember = await prisma.chatMember.findUnique({
                where: { chatId_userId: { chatId, userId } },
            });
            if (!existingMember) {
                return res.status(403).json({ error: 'Вы не участник этой группы' });
            }

            await prisma.chatMember.update({
                where: { chatId_userId: { chatId, userId } },
                data: { lastReadAt: new Date() },
            });

            await prisma.message.updateMany({
                where: {
                    chatId,
                    senderId: { not: userId },
                    status: 'unread',
                },
                data: { status: 'read' },
            });
        } else if (type === 'channel') {
            const channelId = parseInt(id);
            const channelExists = await prisma.channel.findUnique({ where: { id: channelId } });
            if (!channelExists) {
                return res.status(404).json({ error: 'Канал не найден' });
            }

            const member = await prisma.channelMember.findFirst({
                where: { channelId, userId },
            });
            if (!member) {
                return res.status(403).json({ error: 'Вы не участник этого канала' });
            }

            await prisma.channelMember.update({
                where: { id: member.id },
                data: { lastReadAt: new Date() },
            });

            await prisma.message.updateMany({
                where: {
                    channelId,
                    senderId: { not: userId },
                    status: 'unread',
                },
                data: { status: 'read' },
            });
        } else if (type === 'private') {
            const otherUserId = parseInt(id);
            await prisma.message.updateMany({
                where: {
                    OR: [
                        { senderId: otherUserId, receiverId: userId },
                        { senderId: userId, receiverId: otherUserId },
                    ],
                    channelId: null,
                    chatId: null,
                    status: 'unread',
                    senderId: { not: userId },
                },
                data: { status: 'read' },
            });
        } else {
            return res.status(400).json({ error: 'Неизвестный type' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Ошибка в markRead:', error);
        res.status(500).json({
            error: 'Ошибка отметки прочтения',
            details: error.message,
        });
    }
};

module.exports = { markRead };
