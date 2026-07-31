const nodemailer = require('nodemailer');

// Настройка транспорта (для Gmail нужно создать пароль приложения)
const transporter = nodemailer.createTransport({
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    // ✅ ДОБАВЛЯЕМ ЭТУ СТРОЧКУ
    tls: {
        rejectUnauthorized: false,
    },
});

const sendResetEmail = async (email, token) => {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    const mailOptions = {
        from: `"Messenger" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Восстановление пароля',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #10b981; text-align: center;">Восстановление пароля</h2>
                <p>Здравствуйте!</p>
                <p>Вы запросили сброс пароля для вашего аккаунта в мессенджере.</p>
                <p>Для сброса пароля перейдите по ссылке ниже:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" 
                       style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                        Сбросить пароль
                    </a>
                </div>
                <p>Ссылка действительна в течение 1 часа.</p>
                <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0;">
                <p style="color: #888; font-size: 12px; text-align: center;">© Messenger</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Письмо сброса пароля отправлено на ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Ошибка отправки письма:', error);
        return false;
    }
};

module.exports = { sendResetEmail };