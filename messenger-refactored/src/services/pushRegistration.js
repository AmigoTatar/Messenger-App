import { PushNotifications } from '@capacitor/push-notifications';
import { API_BASE_URL, isNativeApp } from '../config';
import { requestFCMToken, deleteWebFCMToken } from '../firebase';
import { RuStorePush } from '../plugins/rustorePush';

const PUSH_CHANNEL_ID = 'potok_messages';
const PUSH_TOKEN_STORAGE_KEY = 'pushToken';
const RUSTORE_TOKEN_STORAGE_KEY = 'rustorePushToken';

let registrationInFlight = null;
let listenersAttached = false;

async function ensurePushChannel() {
  try {
    await PushNotifications.createChannel({
      id: PUSH_CHANNEL_ID,
      name: 'Сообщения',
      description: 'Уведомления о новых сообщениях',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
    console.log('✅ [PUSH] Канал уведомлений создан:', PUSH_CHANNEL_ID);
  } catch (err) {
    console.warn('⚠️ [PUSH] createChannel:', err?.message || err);
  }
}

export async function savePushTokenToServer(tokenValue, platform = 'fcm') {
  const jwt = localStorage.getItem('token');
  if (!jwt) {
    console.warn('🔇 [PUSH] Нет JWT — токен не сохранён');
    return false;
  }
  if (!tokenValue) {
    console.warn('🔇 [PUSH] Пустой токен');
    return false;
  }

  const response = await fetch(`${API_BASE_URL}/api/push-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: tokenValue, platform }),
  });

  if (!response.ok) {
    console.error('❌ [PUSH] Ошибка сохранения:', await response.text());
    return false;
  }

  if (platform === 'rustore') {
    localStorage.setItem(RUSTORE_TOKEN_STORAGE_KEY, tokenValue);
  } else {
    localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, tokenValue);
  }
  console.log('✅ [PUSH] Токен сохранён', platform, '→', API_BASE_URL);
  return true;
}

async function deactivatePushTokenOnServer(tokenValue) {
  const jwt = localStorage.getItem('token');
  if (!jwt || !tokenValue) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/api/push-token`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: tokenValue }),
    });

    if (!response.ok) {
      console.warn('⚠️ [PUSH] Не удалось деактивировать токен:', await response.text());
      return false;
    }

    console.log('✅ [PUSH] Токен деактивирован на сервере');
    return true;
  } catch (err) {
    console.warn('⚠️ [PUSH] Ошибка сети при деактивации:', err);
    return false;
  }
}

async function registerRuStorePush() {
  try {
    const cfg = await RuStorePush.isConfigured();
    if (!cfg?.configured) {
      console.log('ℹ️ [PUSH][RuStore] projectId не задан — пропуск');
      return false;
    }

    const avail = await RuStorePush.checkAvailability();
    console.log('🔍 [PUSH][RuStore] availability:', avail);
    if (!avail?.available) {
      console.warn('🔇 [PUSH][RuStore] недоступен:', avail?.reason || 'unknown');
      return false;
    }

    const { token } = await RuStorePush.getToken();
    if (!token) {
      console.warn('🔇 [PUSH][RuStore] пустой токен');
      return false;
    }
    console.log('📱 [PUSH][RuStore] токен:', String(token).slice(0, 12) + '…');
    return savePushTokenToServer(token, 'rustore');
  } catch (err) {
    console.warn('⚠️ [PUSH][RuStore]', err?.message || err);
    return false;
  }
}

async function registerNativePush() {
  const perm = await PushNotifications.requestPermissions();
  console.log('🔍 [PUSH][APK] Разрешение:', perm);

  if (perm.receive !== 'granted') {
    console.warn('🔇 [PUSH][APK] Разрешение не получено');
    // RuStore всё равно пробуем — на устройствах без GMS FCM может не быть
  } else {
    await ensurePushChannel();

    if (!listenersAttached) {
      await PushNotifications.addListener('registration', async (token) => {
        console.log('📱 [PUSH][APK] FCM-токен:', String(token.value).slice(0, 12) + '…');
        try {
          await savePushTokenToServer(token.value, 'fcm');
        } catch (err) {
          console.error('❌ [PUSH][APK] Ошибка сохранения токена:', err);
        }
      });

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('❌ [PUSH][APK] registrationError:', err);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const raw = action?.notification?.data || action?.notification || {};
        const data = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
        const tag = String(data.tag || '');
        const fromTag = tag.startsWith('potok_') ? tag.slice(6) : '';
        const chatId = data.chatId || data.chat_id || fromTag;
        const senderId = data.senderId || data.sender_id || '';
        if (chatId) {
          window.dispatchEvent(new CustomEvent('potok-open-chat', {
            detail: { chatId: String(chatId), senderId: senderId ? String(senderId) : '' },
          }));
        }
      });

      listenersAttached = true;
    }

    try {
      await PushNotifications.register();
      console.log('✅ [PUSH][APK] FCM register() вызван');
    } catch (err) {
      console.warn('⚠️ [PUSH][APK] FCM register:', err?.message || err);
    }
  }

  await registerRuStorePush();
  return true;
}

async function registerWebPush() {
  console.log('🔍 [PUSH][WEB] Регистрация через Firebase →', API_BASE_URL);
  const token = await requestFCMToken();
  if (!token) {
    console.warn('🔇 [PUSH][WEB] Токен не получен');
    return false;
  }
  return savePushTokenToServer(token, 'web');
}

/**
 * Регистрирует push-токен и сохраняет его на сервер.
 * Безопасно вызывать после логина и при session restore (нужен JWT в localStorage).
 */
export async function registerPush() {
  if (!localStorage.getItem('token')) {
    console.warn('🔇 [PUSH] registerPush пропущен — нет JWT');
    return false;
  }

  if (registrationInFlight) {
    return registrationInFlight;
  }

  registrationInFlight = (async () => {
    try {
      if (isNativeApp) {
        return await registerNativePush();
      }
      return await registerWebPush();
    } catch (err) {
      console.error('❌ [PUSH] Ошибка регистрации:', err);
      return false;
    } finally {
      registrationInFlight = null;
    }
  })();

  return registrationInFlight;
}

/**
 * Деактивирует текущие токены на сервере и снимает FCM в этом браузере.
 * Вызывать ДО очистки JWT из localStorage.
 */
export async function unregisterPush() {
  let fcmToken = localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  const rustoreToken = localStorage.getItem(RUSTORE_TOKEN_STORAGE_KEY);

  if (!isNativeApp && !fcmToken) {
    try {
      fcmToken = await requestFCMToken();
    } catch {
      fcmToken = null;
    }
  }

  try {
    await Promise.all([
      fcmToken ? deactivatePushTokenOnServer(fcmToken) : Promise.resolve(),
      rustoreToken ? deactivatePushTokenOnServer(rustoreToken) : Promise.resolve(),
      !isNativeApp ? deactivateWebTokensOnServer() : Promise.resolve(),
    ]);

    if (isNativeApp) {
      try {
        await PushNotifications.removeAllListeners();
        listenersAttached = false;
        await PushNotifications.unregister();
        console.log('✅ [PUSH][APK] FCM unregister() выполнен');
      } catch (err) {
        console.warn('⚠️ [PUSH][APK] unregister:', err?.message || err);
      }
      try {
        await RuStorePush.deleteToken();
      } catch (err) {
        console.warn('⚠️ [PUSH][RuStore] deleteToken:', err?.message || err);
      }
    } else {
      await deleteWebFCMToken();
    }
  } finally {
    localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(RUSTORE_TOKEN_STORAGE_KEY);
  }
}

async function deactivateWebTokensOnServer() {
  const jwt = localStorage.getItem('token');
  if (!jwt) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/api/push-token`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ allWeb: true }),
    });
    if (!response.ok) {
      console.warn('⚠️ [PUSH] Не удалось снять веб-токены:', await response.text());
      return false;
    }
    console.log('✅ [PUSH] Веб-токены деактивированы на сервере');
    return true;
  } catch (err) {
    console.warn('⚠️ [PUSH] Ошибка сети при allWeb:', err);
    return false;
  }
}

/** Если JWT нет — браузер не должен получать пуши (после logout / чистый визит). */
export async function dropStaleWebPush() {
  if (isNativeApp) return;
  if (localStorage.getItem('token')) return;
  await deleteWebFCMToken();
  localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}
