const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Кеш для дедупликации (храним последние 10 отправленных пушей)
const sentCache = new Map();
const CACHE_TTL = 5000; // 5 секунд

// Инициализация через файл
let isFirebaseInitialized = false;
try {
    const paths = [
        path.join(__dirname, '../potok-messenger-firebase-adminsdk-fbsvc-6933cfa033.json'),
        path.join(__dirname, '../../potok-messenger-firebase-adminsdk-fbsvc-6933cfa033.json'),
        path.join(__dirname, 'potok-messenger-firebase-adminsdk-fbsvc-6933cfa033.json'),
    ];

    let filePath = null;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            filePath = p;
            break;
        }
    }

    if (!filePath) {
        console.log('ℹ️ Файл не найден ни по одному из путей');
        throw new Error('Файл не найден');
    }

    console.log('🔍 Найден файл по пути:', filePath);
    const serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    isFirebaseInitialized = true;
    console.log('✅ Firebase Admin инициализирован (через файл)');
} catch (err) {
    console.log('ℹ️ Ошибка инициализации Firebase:', err.message);
    console.log('ℹ️ Продолжаем работу в режиме заглушки');
}

const sendPush = async (token, title, body, data = {}) => {
    try {
        // === ДЕДУПЛИКАЦИЯ ===
        const cacheKey = `${token}:${title}:${body}`;
        const now = Date.now();
        
        // Проверяем, не отправляли ли мы такое же уведомление недавно
        if (sentCache.has(cacheKey)) {
            const lastSent = sentCache.get(cacheKey);
            if (now - lastSent < CACHE_TTL) {
                console.log(`⏳ [FCM] Пропускаем дубль (${cacheKey.substring(0, 30)}...)`);
                return { success: true, skipped: true };
            }
        }
        
        // Сохраняем в кеш
        sentCache.set(cacheKey, now);
        
        // Очищаем старые записи (чтобы кеш не рос бесконечно)
        if (sentCache.size > 100) {
            const oldest = now - CACHE_TTL * 2;
            for (const [key, time] of sentCache) {
                if (time < oldest) {
                    sentCache.delete(key);
                }
            }
        }

        if (!isFirebaseInitialized) {
            console.log(`📨 [PUSH STUB] ${title}: ${body} → token: ${token?.substring(0, 20)}...`);
            return { success: true, mock: true };
        }

        const message = {
            token,
            notification: { title, body },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'potok_messages',
                },
            },
            data,
        };

        const response = await admin.messaging().send(message);
        console.log(`✅ [FCM] Push отправлен: ${title} → ${response}`);
        return { success: true, response };
    } catch (error) {
        console.error('❌ [FCM] Ошибка отправки:', error.message);

        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
            try {
                const { PrismaClient } = require('@prisma/client');
                const prisma = new PrismaClient();
                await prisma.pushToken.deleteMany({
                    where: { token: token }
                });
                console.log(`🗑️ [FCM] Невалидный токен удалён из БД: ${token.substring(0, 20)}...`);
            } catch (dbError) {
                console.error('❌ [FCM] Ошибка удаления токена из БД:', dbError.message);
            }
        }

        return { success: false, error: error.message };
    }
};

module.exports = { sendPush };