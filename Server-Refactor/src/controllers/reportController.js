const prisma = require('../lib/prisma');

function isAppAdmin(userId) {
    const raw = process.env.ADMIN_USER_IDS || '';
    const ids = raw.split(',').map((s) => Number(s.trim())).filter(Boolean);
    return ids.includes(Number(userId));
}

const createReport = async (req, res) => {
    try {
        const { targetUserId, messageId, reason } = req.body;
        const text = String(reason || '').trim();
        if (text.length < 3) {
            return res.status(400).json({ error: 'Опишите причину жалобы' });
        }
        const report = await prisma.report.create({
            data: {
                reporterId: req.userId,
                targetUserId: targetUserId ? Number(targetUserId) : null,
                messageId: messageId ? Number(messageId) : null,
                reason: text.slice(0, 500),
            },
        });
        res.status(201).json({ success: true, id: report.id });
    } catch (err) {
        console.error('createReport:', err);
        res.status(500).json({ error: 'Не удалось отправить жалобу' });
    }
};

const listReports = async (req, res) => {
    try {
        if (!isAppAdmin(req.userId)) {
            return res.status(403).json({ error: 'Нет доступа' });
        }
        const reports = await prisma.report.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                reporter: { select: { id: true, username: true } },
            },
        });
        res.json(reports);
    } catch (err) {
        console.error('listReports:', err);
        res.status(500).json({ error: 'Не удалось загрузить жалобы' });
    }
};

module.exports = { createReport, listReports, isAppAdmin };
