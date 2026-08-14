import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Инициализируем Firebase App (безопасно)
const app = initializeApp(firebaseConfig);

let messaging = null;
let lastNotificationTime = 0;

// === ВСЯ ЛОГИКА FIREBASE ТОЛЬКО ДЛЯ ВЕБА ===
const isNativeApp =
    typeof window !== 'undefined' &&
    !!window.Capacitor?.isNativePlatform?.();

if (!isNativeApp) {
    try {
        messaging = getMessaging(app);
        console.log('🌐 [Web] Firebase Messaging инициализирован');

        // === FOREGROUND ===
        // Баннер рисуем сами только для data-only.
        // Если есть payload.notification — система/FCM уже могла показать баннер
        // (вкладка в фоне, но страница ещё «alive») — второй new Notification = дубль.
        onMessage(messaging, (payload) => {
            console.log('📨 [Web] foreground FCM:', {
                hasNotification: !!payload.notification,
                title: payload.notification?.title || payload.data?.title,
                tag: payload.data?.tag,
                hidden: typeof document !== 'undefined' ? document.hidden : null,
            });

            const now = Date.now();
            if (now - lastNotificationTime < 3000) {
                console.log('⏳ [FCM] Пропускаем дубль (debounce 3s)');
                return;
            }

            if (payload.notification) {
                console.log('⏳ [FCM] Пропуск new Notification — уже есть notification-payload');
                return;
            }

            if (typeof document !== 'undefined' && !document.hidden) {
                console.log('⏳ [FCM] Вкладка активна — баннер не показываем (сокет + звук)');
                return;
            }

            lastNotificationTime = now;
            const title = payload.data?.title || 'Новое сообщение';
            const body = payload.data?.body || '';
            const tag = payload.data?.tag || 'potok_message';

            if (Notification.permission === 'granted') {
                console.log('🔔 [FCM] data-only → new Notification', { title, tag });
                new Notification(title, {
                    body,
                    icon: '/logo.png',
                    tag,
                    renotify: false,
                });
            }
        });

    } catch (e) {
        console.warn('⚠️ [Web] Ошибка инициализации Messaging:', e);
    }
} else {
    console.log('📱 [Capacitor] Firebase Messaging веб-версии пропущен');
}

// === requestFCMToken ===
export const requestFCMToken = async () => {
    if (isNativeApp) {
        console.log('📱 [Capacitor] Запрос веб-токена пропущен (нативное приложение)');
        return null;
    }

    if (!messaging) {
        console.warn('⚠️ [Web] Messaging не инициализирован');
        return null;
    }

    try {
        if (Notification.permission === 'denied') {
            console.warn('🔇 Уведомления запрещены');
            return null;
        }
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('🔇 Разрешение не получено');
                return null;
            }
        }
        const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });
        console.log('📱 [Web] FCM-токен получен:', token);
        return token;
    } catch (error) {
        console.error('❌ [Web] Ошибка FCM:', error);
        return null;
    }
};

// === onForegroundMessage (заглушка для Capacitor) ===
export const onForegroundMessage = (callback) => {
    if (!messaging) {
        console.log('ℹ️ [Capacitor] onForegroundMessage заглушка');
        return;
    }
    // В вебе onMessage уже вызывается выше, так что здесь просто заглушка
};