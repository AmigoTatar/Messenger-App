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

    return sendEmail(email, 'Восстановление пароля', html);
};

const sendEmail = async (to, subject, html) => {
    if (process.env.UNISENDER_API_KEY) {
        try {
            const ok = await sendViaUnisender(to, subject, html);
            if (ok) return true;
        } catch (err) {
            console.error('❌ Unisender API:', err.message);
        }
    }
    return sendViaSmtp(to, subject, html);
};

const sendReportEmail = async ({ reporterName, reporterId, targetUserId, messageId, reason, reportId }) => {
    const raw = process.env.REPORT_EMAIL || process.env.SMTP_USER || '';
    const recipients = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (recipients.length === 0) {
        console.warn('⚠️ REPORT_EMAIL / SMTP_USER не задан — жалоба сохранена, письмо не отправлено');
        return false;
    }
    const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #dc2626; text-align: center;">Новая жалоба в Потоке</h2>
                <p><strong>№</strong> ${reportId}</p>
                <p><strong>Кто:</strong> ${reporterName || 'пользователь'} (id ${reporterId})</p>
                <p><strong>На кого:</strong> ${targetUserId || '—'}</p>
                <p><strong>Сообщение:</strong> ${messageId || '—'}</p>
                <p><strong>Причина:</strong></p>
                <p style="background:#f4f4f5;padding:12px;border-radius:8px;">${String(reason || '').replace(/</g, '&lt;')}</p>
            </div>
        `;
    const results = await Promise.all(recipients.map((to) => sendEmail(to, 'Поток: новая жалоба', html)));
    return results.some(Boolean);
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
    console.log(`✅ Письмо отправлено (Unisender) на ${to}: ${subject}`);
    return true;
}

async function sendViaSmtp(email, subject, html) {
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
            subject,
            html,
        });
        console.log(`✅ Письмо отправлено (SMTP) на ${email}: ${subject}`);
        return true;
    } catch (error) {
        console.error('❌ Ошибка SMTP:', error);
        return false;
    }
}

module.exports = { sendResetEmail, sendEmail, sendReportEmail };
