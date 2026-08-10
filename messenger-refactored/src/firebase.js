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

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestFCMToken = async () => {
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
        console.log('📱 FCM-токен получен:', token);
        return token;
    } catch (error) {
        console.error('❌ Ошибка FCM:', error);
        return null;
    }
};

export const onForegroundMessage = (callback) => {
    onMessage(messaging, (payload) => {
        console.log('📨 Push получен (foreground):', payload);
        if (callback) callback(payload);
    });
};