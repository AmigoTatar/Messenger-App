// Импорты Firebase
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Жёстко задаём конфиг (временно для теста)
const firebaseConfig = {
    apiKey: 'AIzaSyC_iLEXJxlIgcaSlHn3DdL8GENTFkhn6Nc',
    authDomain: 'potok-messenger.firebaseapp.com',
    projectId: 'potok-messenger',
    storageBucket: 'potok-messenger.firebasestorage.app',
    messagingSenderId: '1001298925555',
    appId: '1:1001298925555:web:10b169e50fde9719646486'
};

// Инициализация
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Обработка фоновых уведомлений
messaging.onBackgroundMessage((payload) => {
    console.log('📨 [SW] Фоновое уведомление:', payload);
    const title = payload.notification?.title || 'Новое сообщение';
    const options = {
        body: payload.notification?.body || 'У вас новое сообщение',
        icon: '/icon-192x192.png',
        data: payload.data,
    };
    self.registration.showNotification(title, options);
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