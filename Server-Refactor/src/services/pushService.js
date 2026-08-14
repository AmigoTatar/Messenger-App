const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Кеш для дедупликации
const sentCache = new Map();
const CACHE_TTL = 5000; // 5 секунд

let isFirebaseInitialized = false;

function tryInitFromEnv() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) return false;

    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin инициализирован (через FIREBASE_SERVICE_ACCOUNT_JSON)');
    return true;
}

function tryInitFromFile() {
    const paths = [
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
        path.join(__dirname, '../potok-messenger-firebase-adminsdk-fbsvc-6933cfa033.json'),
        path.join(__dirname, '../../potok-messenger-firebase-adminsdk-fbsvc-6933cfa033.json'),
        path.join(__dirname, 'potok-messenger-firebase-adminsdk-fbsvc-6933cfa033.json'),
    ].filter(Boolean);

    let filePath = null;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            filePath = p;
            break;
        }
    }

    if (!filePath) {
        throw new Error(
            'Firebase credentials не найдены: задайте FIREBASE_SERVICE_ACCOUNT_JSON или положите adminsdk JSON рядом с сервером'
        );
    }

    console.log('🔍 Найден Firebase credentials файл:', filePath);
    const serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin инициализирован (через файл)');
    return true;
}

try {
    if (admin.apps.length === 0) {
        if (!tryInitFromEnv()) {
            tryInitFromFile();
        }
    }
    isFirebaseInitialized = true;
} catch (err) {
    isFirebaseInitialized = false;
    console.error('❌ Firebase Admin НЕ инициализирован:', err.message);
    console.error('❌ Пуши не будут доставляться, пока не настроены credentials');
}

const sendPush = async (token, title, body, data = {}) => {
    try {
        const tag = data.tag || data.chatId || 'potok_message';
        const cacheKey = `${token}:${tag}:${title}:${body}`;
        const now = Date.now();

        if (sentCache.has(cacheKey)) {
            const lastSent = sentCache.get(cacheKey);
            if (now - lastSent < CACHE_TTL) {
                console.log(`⏳ [FCM] Пропускаем дубль (${cacheKey.substring(0, 40)}...)`);
                return { success: true, skipped: true };
            }
        }

        sentCache.set(cacheKey, now);

        if (sentCache.size > 100) {
            const oldest = now - CACHE_TTL * 2;
            for (const [key, time] of sentCache) {
                if (time < oldest) {
                    sentCache.delete(key);
                }
            }
        }

        if (!isFirebaseInitialized) {
            console.error(
                `❌ [FCM] Пропуск отправки (Admin SDK не инициализирован): ${title} → ${token?.substring(0, 20)}...`
            );
            return { success: false, error: 'Firebase Admin not initialized' };
        }

        // data values must be strings for FCM
        const stringData = Object.fromEntries(
            Object.entries({
                title,
                body,
                tag,
                ...data,
            }).map(([k, v]) => [k, v == null ? '' : String(v)])
        );

        const message = {
            token,
            // Один notification-блок на верхнем уровне.
            // Дублировать в webpush.notification нельзя — Chrome рисует два баннера.
            notification: { title, body },
            android: {
                priority: 'high',
                collapseKey: String(tag).slice(0, 64),
                notification: {
                    sound: 'default',
                    channelId: 'potok_messages',
                    tag: String(tag),
                },
            },
            webpush: {
                headers: {
                    Urgency: 'high',
                    TTL: '86400',
                },
                fcmOptions: {
                    link: stringData.url || '/',
                },
            },
            data: stringData,
        };

        console.log(
            `📤 [FCM] send → token=${token.substring(0, 12)}… tag=${tag} title="${title}"`
        );
        const response = await admin.messaging().send(message);
        console.log(`✅ [FCM] Push отправлен: ${title} → ${response}`);
        return { success: true, response };
    } catch (error) {
        console.error('❌ [FCM] Ошибка отправки:', error.message);

        if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered'
        ) {
            try {
                const prisma = require('../lib/prisma');
                await prisma.pushToken.deleteMany({
                    where: { token: token },
                });
                console.log(`🗑️ [FCM] Невалидный токен удалён из БД: ${token.substring(0, 20)}...`);
            } catch (dbError) {
                console.error('❌ [FCM] Ошибка удаления токена из БД:', dbError.message);
            }
        }

        return { success: false, error: error.message };
    }
};

module.exports = { sendPush, isFirebaseInitialized: () => isFirebaseInitialized };
