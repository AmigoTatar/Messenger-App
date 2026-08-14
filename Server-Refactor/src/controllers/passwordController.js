const prisma = require('../lib/prisma');
const crypto = require('crypto');
const { sendResetEmail } = require('../utils/email');

// Генерация случайного токена
const generateToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// ЗАПРОС НА СБРОС ПАРОЛЯ

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email обязателен' });
        }

        // Проверяем, существует ли пользователь
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!user) {
            // Для безопасности не говорим, что пользователь не найден
            return res.status(200).json({
                message: 'Если пользователь с таким email существует, мы отправили ссылку для сброса пароля'
            });
        }

        // Удаляем старые неиспользованные токены для этого email
        await prisma.passwordReset.deleteMany({
            where: {
                email: email.toLowerCase(),
                used: false,
                expiresAt: { lt: new Date() }
            }
        });

        // Создаём новый токен
        const token = generateToken();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Токен живёт 1 час

        await prisma.passwordReset.create({
            data: {
                email: email.toLowerCase(),
                token,
                expiresAt,
                used: false
            }
        });

       
        // Отправляем письмо с ссылкой

const emailSent = await sendResetEmail(email, token);

if (!emailSent) {
   
    console.log(`🔐 Токен для сброса пароля (${email}): ${token}`);
}

        

        res.status(200).json({
            message: 'Если пользователь с таким email существует, мы отправили ссылку для сброса пароля'
        });
    } catch (error) {
        console.error('❌ Ошибка forgotPassword:', error);
        res.status(500).json({ error: 'Не удалось обработать запрос' });
    }
};


// СБРОС ПАРОЛЯ (по токену)

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Токен и новый пароль обязательны' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов' });
        }

        // Находим токен
        const resetRecord = await prisma.passwordReset.findUnique({
            where: { token }
        });

        if (!resetRecord) {
            return res.status(400).json({ error: 'Неверный или истёкший токен' });
        }

        // Проверяем, не истёк ли токен
        if (resetRecord.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Токен истёк. Запросите сброс заново' });
        }

        // Проверяем, не использован ли токен
        if (resetRecord.used) {
            return res.status(400).json({ error: 'Токен уже использован' });
        }

        // Хешируем новый пароль
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Обновляем пароль пользователя
        await prisma.user.update({
            where: { email: resetRecord.email },
            data: { password: hashedPassword }
        });

        // Помечаем токен как использованный
        await prisma.passwordReset.update({
            where: { id: resetRecord.id },
            data: { used: true }
        });

        res.status(200).json({
            message: 'Пароль успешно обновлён'
        });
    } catch (error) {
        console.error('❌ Ошибка resetPassword:', error);
        res.status(500).json({ error: 'Не удалось сбросить пароль' });
    }
};

module.exports = {
    forgotPassword,
    resetPassword
};