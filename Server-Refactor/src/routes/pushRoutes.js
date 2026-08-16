const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

// Сохранение push-токена
router.post('/', authenticateToken, async (req, res) => {
    try {
        console.log('🔍 [pushRoutes] req.user:', req.user);
        console.log('🔍 [pushRoutes] req.userId:', req.userId);
        
        const { token, platform } = req.body;
        const safePlatform = platform === 'rustore' ? 'rustore' : platform === 'web' ? 'web' : 'fcm';
        
        // Пытаемся найти userId в разных местах
        const userId = req.user?.id || req.userId || req.user?.userId;
        
        if (!userId) {
            console.error('❌ [pushRoutes] userId не найден');
            return res.status(401).json({ error: 'Пользователь не авторизован' });
        }

        console.log(`✅ [pushRoutes] Сохраняем токен для userId: ${userId} platform=${safePlatform}`);

        await prisma.pushToken.upsert({
            where: { token },
            update: { 
                userId, 
                platform: safePlatform,
                isActive: true,
                updatedAt: new Date()
            },
            create: { 
                userId, 
                token,
                platform: safePlatform,
                isActive: true
            }
        });

        res.json({ success: true, message: 'Push-токен сохранён' });
    } catch (err) {
        console.error('❌ Ошибка сохранения push-токена:', err);
        res.status(500).json({ error: err.message });
    }
});

// Удаление / деактивация push-токена (только свой токен)
router.delete('/', authenticateToken, async (req, res) => {
    try {
        const { token, allWeb } = req.body || {};
        const userId = req.user?.id || req.userId || req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Пользователь не авторизован' });
        }

        if (allWeb) {
            const result = await prisma.pushToken.updateMany({
                where: { userId, platform: 'web' },
                data: { isActive: false },
            });
            return res.json({
                success: true,
                message: 'Веб push-токены деактивированы',
                deactivated: result.count,
            });
        }

        if (!token) {
            return res.status(400).json({ error: 'token обязателен' });
        }

        const result = await prisma.pushToken.updateMany({
            where: { token, userId },
            data: { isActive: false },
        });

        res.json({
            success: true,
            message: 'Push-токен удалён',
            deactivated: result.count,
        });
    } catch (err) {
        console.error('❌ Ошибка удаления push-токена:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;