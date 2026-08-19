const prisma = require('../lib/prisma');
const { emitToUser } = require('../utils/onlineUsers');

const blockUser = async (req, res) => {
    try {
        const blockerId = req.userId;
        const blockedId = Number(req.body.userId);
        if (!blockedId || blockedId === blockerId) {
            return res.status(400).json({ error: 'Некорректный пользователь' });
        }
        await prisma.userBlock.upsert({
            where: { blockerId_blockedId: { blockerId, blockedId } },
            update: {},
            create: { blockerId, blockedId },
        });
        const io = req.app.get('io');
        if (io) {
            emitToUser(io, blockedId, 'user_blocked', { by: blockerId });
            emitToUser(io, blockerId, 'block_updated', { userId: blockedId, blockedByMe: true });
        }
        res.json({ success: true, blocked: true });
    } catch (err) {
        console.error('blockUser:', err);
        res.status(500).json({ error: 'Не удалось заблокировать' });
    }
};

const unblockUser = async (req, res) => {
    try {
        const blockerId = req.userId;
        const blockedId = Number(req.params.userId);
        await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
        const io = req.app.get('io');
        if (io) {
            emitToUser(io, blockedId, 'user_unblocked', { by: blockerId });
            emitToUser(io, blockerId, 'block_updated', { userId: blockedId, blockedByMe: false });
        }
        res.json({ success: true, blocked: false });
    } catch (err) {
        console.error('unblockUser:', err);
        res.status(500).json({ error: 'Не удалось разблокировать' });
    }
};

const getBlockStatus = async (req, res) => {
    try {
        const me = req.userId;
        const other = Number(req.query.userId);
        if (!other) return res.json({ blockedByMe: false, blockedMe: false });
        const [blockedByMe, blockedMe] = await Promise.all([
            prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: me, blockedId: other } } }),
            prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: other, blockedId: me } } }),
        ]);
        res.json({ blockedByMe: !!blockedByMe, blockedMe: !!blockedMe });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка статуса блокировки' });
    }
};

module.exports = { blockUser, unblockUser, getBlockStatus };
