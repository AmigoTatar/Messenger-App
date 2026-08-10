const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;
        await prisma.pushToken.upsert({
            where: { token },
            update: { userId, isActive: true, updatedAt: new Date() },
            create: { userId, token }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/', authenticateToken, async (req, res) => {
    try {
        const { token } = req.body;
        await prisma.pushToken.update({
            where: { token },
            data: { isActive: false }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;