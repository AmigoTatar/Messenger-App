const admin = require('firebase-admin');

// Инициализация Firebase Admin только если есть ключи
let isFirebaseInitialized = false;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        isFirebaseInitialized = true;
        console.log('✅ Firebase Admin инициализирован');
    } else {
        console.log('ℹ️ FIREBASE_SERVICE_ACCOUNT не задан, работаем в режиме заглушки');
    }
} catch (err) {
    console.warn('⚠️ Ошибка инициализации Firebase:', err.message);
    console.log('ℹ️ Продолжаем работу в режиме заглушки');
}

const sendPush = async (token, title, body) => {
    try {
        // Если Firebase не инициализирован — работаем в режиме заглушки
        if (!isFirebaseInitialized) {
            console.log(`📨 [PUSH STUB] ${title}: ${body} → token: ${token.substring(0, 20)}...`);
            return { success: true, mock: true };
        }

        // Если инициализирован — отправляем реальный пуш
        await admin.messaging().send({
            token,
            notification: { title, body },
        });
        console.log('✅ Push отправлен:', title);
        return { success: true };
    } catch (err) {
        console.error('❌ Ошибка push:', err.message);
        return { success: false, error: err.message };
    }
};

module.exports = { sendPush };