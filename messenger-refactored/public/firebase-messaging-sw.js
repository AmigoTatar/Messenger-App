// Импорты Firebase
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: 'AIzaSyC_iLEXJxlIgcaSlHn3DdL8GENTFkhn6Nc',
    authDomain: 'potok-messenger.firebaseapp.com',
    projectId: 'potok-messenger',
    storageBucket: 'potok-messenger.firebasestorage.app',
    messagingSenderId: '1001298925555',
    appId: '1:1001298925555:web:10b169e50fde9719646486'
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

/**
 * Фоновые пуши:
 * - Если в payload есть `notification`, браузер/FCM уже сам рисует баннер.
 *   Повторный showNotification = классический дубль — НЕ показываем снова.
 * - showNotification только для data-only сообщений.
 */
messaging.onBackgroundMessage((payload) => {
    console.log('📨 [SW] background FCM:', {
        hasNotification: !!payload.notification,
        title: payload.notification?.title || payload.data?.title,
        tag: payload.data?.tag,
    });

    if (payload.notification) {
        console.log('⏳ [SW] Пропуск showNotification — FCM уже отобразил notification-payload');
        return;
    }

    const title = payload.data?.title || 'Новое сообщение';
    const body = payload.data?.body || 'У вас новое сообщение';
    const tag = payload.data?.tag || 'potok_message';

    console.log('🔔 [SW] data-only → showNotification', { title, tag });
    self.registration.showNotification(title, {
        body,
        icon: '/icon-192x192.png',
        tag,
        renotify: false,
        data: payload.data || {},
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (const client of windowClients) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
