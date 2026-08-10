const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

// Сохранение push-токена
router.post('/', authenticateToken, async (req, res) => {
    try {
        console.log('🔍 [pushRoutes] req.user:', req.user);
        console.log('🔍 [pushRoutes] req.userId:', req.userId);
        
        const { token } = req.body;
        
        // Пытаемся найти userId в разных местах
        const userId = req.user?.id || req.userId || req.user?.userId;
        
        if (!userId) {
            console.error('❌ [pushRoutes] userId не найден');
            return res.status(401).json({ error: 'Пользователь не авторизован' });
        }

        console.log(`✅ [pushRoutes] Сохраняем токен для userId: ${userId}`);

        await prisma.pushToken.upsert({
            where: { token },
            update: { 
                userId, 
                isActive: true,
                updatedAt: new Date()
            },
            create: { 
                userId, 
                token,
                isActive: true
            }
        });

        res.json({ success: true, message: 'Push-токен сохранён' });
    } catch (err) {
        console.error('❌ Ошибка сохранения push-токена:', err);
        res.status(500).json({ error: err.message });
    }
});

// Удаление push-токена
router.delete('/', authenticateToken, async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user?.id || req.userId || req.user?.userId;
        
        if (!userId) {
            return res.status(401).json({ error: 'Пользователь не авторизован' });
        }

        await prisma.pushToken.update({
            where: { token },
            data: { isActive: false }
        });

        res.json({ success: true, message: 'Push-токен удалён' });
    } catch (err) {
        console.error('❌ Ошибка удаления push-токена:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;