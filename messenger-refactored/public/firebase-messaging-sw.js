// Импорты для Firebase Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Конфиг Firebase (из .env)
const firebaseConfig = {
    apiKey: self.__ENV?.VITE_FIREBASE_API_KEY || '',
    authDomain: self.__ENV?.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: self.__ENV?.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: self.__ENV?.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: self.__ENV?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: self.__ENV?.VITE_FIREBASE_APP_ID || '',
};

// Инициализация
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Обработка фоновых уведомлений
messaging.onBackgroundMessage((payload) => {
    console.log('📨 [SW] Фоновое уведомление:', payload);
    const notificationTitle = payload.notification?.title || 'Новое сообщение';
    const notificationOptions = {
        body: payload.notification?.body || 'У вас новое сообщение',
        icon: '/icon-192x192.png',
        data: payload.data,
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});