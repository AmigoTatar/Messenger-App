const jwt = require('jsonwebtoken');
const { isTokenRevoked } = require('../utils/tokenRevoke');
const prisma = require('../lib/prisma');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'Доступ запрещен. Токен отсутствует.' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(400).json({ error: 'Некорректный формат авторизации' });
    }

    const token = parts[1];

    if (isTokenRevoked(token)) {
        return res.status(403).json({ error: 'Токен отозван. Войдите снова.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Невалидный или просроченный токен' });
        }
        req.userId = Number(decoded.userId);
        req.authToken = token;
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.userId },
                select: { tokenVersion: true },
            });
            if (!user || (decoded.tokenVersion ?? 0) !== user.tokenVersion) {
                return res.status(403).json({ error: 'Токен отозван. Войдите снова.' });
            }
            next();
        } catch (e) {
            console.error('❌ [JWT] tokenVersion:', e.message);
            return res.status(500).json({ error: 'Ошибка проверки токена' });
        }
    });
};

module.exports = { authenticateToken };
