import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';
import { isNativeApp } from './config';

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

if (!isNativeApp) {
    try {
        messaging = getMessaging(app);
        console.log('🌐 [Web] Firebase Messaging инициализирован');

        // FCM считает страницу foreground, пока открыта любая вкладка сайта.
        // Тогда браузер сам баннер НЕ рисует — только onMessage.
        // Видимая вкладка: хватает сокета. Скрытая: рисуем баннер сами.
        onMessage(messaging, (payload) => {
            const title = payload.notification?.title || payload.data?.title || 'Новое сообщение';
            const body = payload.notification?.body || payload.data?.body || '';
            const tag = payload.data?.tag || 'potok_message';
            const hidden = typeof document !== 'undefined' ? document.hidden : true;

            console.log('📨 [Web] foreground FCM:', {
                hasNotification: !!payload.notification,
                title,
                tag,
                hidden,
            });

            if (!hidden) {
                console.log('⏳ [FCM] Вкладка на экране — баннер не показываем (сокет)');
                return;
            }

            const now = Date.now();
            if (now - lastNotificationTime < 3000) {
                console.log('⏳ [FCM] Пропускаем дубль (debounce 3s)');
                return;
            }
            lastNotificationTime = now;

            if (Notification.permission === 'granted') {
                console.log('🔔 [FCM] вкладка скрыта → Notification', { title, tag });
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
        console.log('📱 [Web] FCM-токен получен:', token ? String(token).slice(0, 12) + '…' : token);
        return token;
    } catch (error) {
        console.error('❌ [Web] Ошибка FCM:', error);
        return null;
    }
};

/** Снимает FCM-подписку этого браузера и firebase service worker. */
export const deleteWebFCMToken = async () => {
    if (isNativeApp) return false;
    let ok = false;
    try {
        if (messaging) {
            await deleteToken(messaging);
            console.log('🗑️ [Web] FCM-подписка браузера снята');
            ok = true;
        }
    } catch (error) {
        console.warn('⚠️ [Web] deleteToken:', error?.message || error);
    }
    try {
        await unregisterMessagingServiceWorkers();
    } catch (error) {
        console.warn('⚠️ [Web] unregister SW:', error?.message || error);
    }
    return ok;
};

async function unregisterMessagingServiceWorkers() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(async (reg) => {
        const url = [reg.active, reg.waiting, reg.installing]
            .map((worker) => worker?.scriptURL || '')
            .join(' ');
        if (!url) return;
        const isFcmSw = /firebase-messaging/i.test(url) || /\/sw\.js(?:\?|$)/i.test(url);
        if (!isFcmSw) return;
        await reg.unregister();
        console.log('🗑️ [Web] Service worker снят:', url);
    }));
}

// === onForegroundMessage (заглушка для Capacitor) ===
export const onForegroundMessage = (callback) => {
    if (!messaging) {
        console.log('ℹ️ [Capacitor] onForegroundMessage заглушка');
        return;
    }
    // В вебе onMessage уже вызывается выше, так что здесь просто заглушка
};

if (!isNativeApp && typeof window !== 'undefined' && !localStorage.getItem('token')) {
    deleteWebFCMToken().catch(() => {});
}