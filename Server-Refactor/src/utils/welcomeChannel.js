const prisma = require('../lib/prisma');

function parseWelcomeChannelId() {
    const raw = String(process.env.WELCOME_CHANNEL_ID || '').trim();
    if (!raw) return null;
    const channelId = parseInt(raw, 10);
    if (!Number.isInteger(channelId) || channelId < 1) {
        console.warn('WELCOME_CHANNEL_ID некорректный, пропускаю автоподписку');
        return null;
    }
    return channelId;
}

/**
 * После register: member на канал-инструкцию.
 * Ошибка или пустой env не должны валить регистрацию.
 */
async function subscribeToWelcomeChannel(userId) {
    const channelId = parseWelcomeChannelId();
    if (!channelId || !userId) return;

    try {
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { id: true },
        });
        if (!channel) {
            console.warn(`WELCOME_CHANNEL_ID=${channelId}: канал не найден`);
            return;
        }

        const lastPost = await prisma.message.findFirst({
            where: { channelId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });
        const lastReadAt = lastPost
            ? new Date(lastPost.createdAt.getTime() - 1)
            : new Date();

        await prisma.channelMember.create({
            data: {
                channelId,
                userId,
                role: 'member',
                lastReadAt,
            },
        });
    } catch (err) {
        if (err.code === 'P2002') return;
        console.error('Не удалось подписать на welcome-канал:', err.message);
    }
}

module.exports = { subscribeToWelcomeChannel };
