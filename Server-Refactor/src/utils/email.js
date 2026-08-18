const sendResetEmail = async (email, token) => {
    const raw = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const frontend = (!raw || /localhost|127\.0\.0\.1/i.test(raw))
        ? 'https://potokmessenger.ru'
        : raw;
    const resetLink = `${frontend}/reset-password?token=${token}`;

    const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #10b981; text-align: center;">Восстановление пароля</h2>
                <p>Здравствуйте!</p>
                <p>Вы запросили сброс пароля для вашего аккаунта в мессенджере Поток.</p>
                <p>Для сброса пароля перейдите по ссылке ниже:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" 
                       style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                        Сбросить пароль
                    </a>
                </div>
                <p>Ссылка действительна в течение 1 часа.</p>
                <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
            </div>
        `;

    if (process.env.UNISENDER_API_KEY) {
        try {
            const ok = await sendViaUnisender(email, 'Восстановление пароля', html);
            if (ok) return true;
        } catch (err) {
            console.error('❌ Unisender API:', err.message);
        }
    }

    return sendViaSmtp(email, html);
};

async function sendViaUnisender(to, subject, html) {
    const base = (process.env.UNISENDER_API_URL || 'https://goapi.unisender.ru/ru/transactional/api/v1').replace(/\/$/, '');
    const fromEmail = process.env.UNISENDER_FROM_EMAIL || process.env.SMTP_USER;
    if (!fromEmail) {
        console.error('❌ UNISENDER_FROM_EMAIL / SMTP_USER не задан');
        return false;
    }
    const res = await fetch(`${base}/email/send.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': process.env.UNISENDER_API_KEY,
        },
        body: JSON.stringify({
            message: {
                recipients: [{ email: to }],
                subject,
                body: { html },
                from_email: fromEmail,
                from_name: process.env.UNISENDER_FROM_NAME || 'Potok',
            },
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === 'error') {
        console.error('❌ Unisender ответ:', res.status, data);
        return false;
    }
    console.log(`✅ Письмо сброса пароля отправлено (Unisender) на ${to}`);
    return true;
}

async function sendViaSmtp(email, html) {
    const nodemailer = require('nodemailer');
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('❌ SMTP не настроен и Unisender не сработал');
        return false;
    }
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.yandex.ru',
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
    });
    try {
        await transporter.sendMail({
            from: `"Potok" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Восстановление пароля',
            html,
        });
        console.log(`✅ Письмо сброса пароля отправлено (SMTP) на ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Ошибка SMTP:', error);
        return false;
    }
}

module.exports = { sendResetEmail };
