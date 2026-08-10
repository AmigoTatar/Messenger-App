const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Инициализация через файл
let isFirebaseInitialized = false;
try {
    // Проверяем разные варианты путей
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
    console.log('🔍 serviceAccount.private_key_id:', serviceAccount.private_key_id?.substring(0, 10));
console.log('🔍 serviceAccount.private_key:', serviceAccount.private_key?.substring(0, 30));
console.log('🔍 serviceAccount.client_email:', serviceAccount.client_email);
console.log('🔍 Все ключи объекта:', Object.keys(serviceAccount));
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
        return { success: false, error: error.message };
    }
};

module.exports = { sendPush };