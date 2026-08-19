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

const sendFcmPush = async (token, title, body, data = {}) => {
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

        // data values must be strings for FCM. Не кладём полный текст — лимит 4KB.
        const clip = (s, n) => {
            const t = String(s || '');
            return t.length <= n ? t : `${t.slice(0, n)}…`;
        };
        const safeTitle = clip(title, 80);
        const safeBody = clip(body, 180);
        const stringData = Object.fromEntries(
            Object.entries({
                title: safeTitle,
                body: safeBody,
                tag: String(tag).slice(0, 64),
                chatId: data.chatId || '',
                senderId: data.senderId || '',
                url: data.url || '/',
                messageId: data.messageId || '',
            }).map(([k, v]) => [k, v == null ? '' : String(v)])
        );

        const message = {
            token,
            notification: { title: safeTitle, body: safeBody },
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
        console.error('❌ [FCM] Ошибка отправки:', error.code || '', error.message);

        const code = String(error.code || '');
        const msg = String(error.message || '');
        if (
            code.includes('registration-token-not-registered') ||
            code.includes('invalid-registration-token') ||
            /notregistered|unregistered|invalid-registration/i.test(msg)
        ) {
            await deleteInvalidToken(token, 'FCM');
        }

        return { success: false, error: error.message };
    }
};

async function deleteInvalidToken(token, label) {
    try {
        const prisma = require('../lib/prisma');
        await prisma.pushToken.deleteMany({ where: { token } });
        console.log(`🗑️ [${label}] Невалидный токен удалён из БД: ${token.substring(0, 20)}...`);
    } catch (dbError) {
        console.error(`❌ [${label}] Ошибка удаления токена из БД:`, dbError.message);
    }
}

const sendRuStorePush = async (token, title, body, data = {}) => {
    const projectId = process.env.RUSTORE_PROJECT_ID;
    const serviceToken = process.env.RUSTORE_SERVICE_TOKEN;
    if (!projectId || !serviceToken || projectId === 'REPLACE_ME') {
        console.warn('⚠️ [RuStore] Пропуск: задайте RUSTORE_PROJECT_ID и RUSTORE_SERVICE_TOKEN');
        return { success: false, error: 'RuStore credentials missing' };
    }

    const tag = data.tag || data.chatId || 'potok_message';
    const cacheKey = `rustore:${token}:${tag}:${title}:${body}`;
    const now = Date.now();
    if (sentCache.has(cacheKey) && now - sentCache.get(cacheKey) < CACHE_TTL) {
        console.log(`⏳ [RuStore] Пропускаем дубль`);
        return { success: true, skipped: true };
    }
    sentCache.set(cacheKey, now);

    const stringData = Object.fromEntries(
        Object.entries({
            title,
            body,
            tag,
            ...data,
        }).map(([k, v]) => [k, v == null ? '' : String(v)])
    );

    try {
        const url = `https://vkpns.rustore.ru/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceToken}`,
            },
            body: JSON.stringify({
                message: {
                    token,
                    notification: { title, body },
                    android: {
                        notification: {
                            title,
                            body,
                            channel_id: 'potok_messages',
                        },
                    },
                    data: stringData,
                },
            }),
        });

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const status = errBody?.error?.status || res.status;
            console.error('❌ [RuStore] Ошибка отправки:', res.status, errBody);
            if (status === 'NOT_FOUND' || status === 'UNREGISTERED' || res.status === 404) {
                await deleteInvalidToken(token, 'RuStore');
            }
            return { success: false, error: errBody?.error?.message || `HTTP ${res.status}` };
        }

        console.log(`✅ [RuStore] Push отправлен: ${title}`);
        return { success: true };
    } catch (error) {
        console.error('❌ [RuStore] Ошибка сети:', error.message);
        return { success: false, error: error.message };
    }
};

const sendPush = async (token, title, body, data = {}, platform = 'fcm') => {
    if (platform === 'rustore') {
        return sendRuStorePush(token, title, body, data);
    }
    return sendFcmPush(token, title, body, data);
};

module.exports = { sendPush, isFirebaseInitialized: () => isFirebaseInitialized };
