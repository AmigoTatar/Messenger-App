import { PushNotifications } from '@capacitor/push-notifications';
import { API_BASE_URL, isNativeApp } from '../config';
import { requestFCMToken } from '../firebase';

const PUSH_CHANNEL_ID = 'potok_messages';
const PUSH_TOKEN_STORAGE_KEY = 'pushToken';

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

export async function savePushTokenToServer(tokenValue) {
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
    body: JSON.stringify({ token: tokenValue }),
  });

  if (!response.ok) {
    console.error('❌ [PUSH] Ошибка сохранения:', await response.text());
    return false;
  }

  localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, tokenValue);
  console.log('✅ [PUSH] Токен сохранён на', API_BASE_URL);
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

async function registerNativePush() {
  const perm = await PushNotifications.requestPermissions();
  console.log('🔍 [PUSH][APK] Разрешение:', perm);

  if (perm.receive !== 'granted') {
    console.warn('🔇 [PUSH][APK] Разрешение не получено');
    return false;
  }

  await ensurePushChannel();

  if (!listenersAttached) {
    await PushNotifications.addListener('registration', async (token) => {
      console.log('📱 [PUSH][APK] FCM-токен:', token.value);
      try {
        await savePushTokenToServer(token.value);
      } catch (err) {
        console.error('❌ [PUSH][APK] Ошибка сохранения токена:', err);
      }
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('❌ [PUSH][APK] registrationError:', err);
    });

    listenersAttached = true;
  }

  // listener уже висит — теперь register()
  await PushNotifications.register();
  console.log('✅ [PUSH][APK] register() вызван');
  return true;
}

async function registerWebPush() {
  console.log('🔍 [PUSH][WEB] Регистрация через Firebase →', API_BASE_URL);
  const token = await requestFCMToken();
  if (!token) {
    console.warn('🔇 [PUSH][WEB] Токен не получен');
    return false;
  }
  return savePushTokenToServer(token);
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

  // Дедуп параллельных вызовов (логин + session restore / StrictMode)
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
 * Деактивирует текущий токен на сервере и снимает регистрацию на устройстве.
 * Вызывать ДО очистки JWT из localStorage.
 */
export async function unregisterPush() {
  const tokenValue = localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);

  try {
    if (tokenValue) {
      await deactivatePushTokenOnServer(tokenValue);
    }

    if (isNativeApp) {
      try {
        await PushNotifications.removeAllListeners();
        listenersAttached = false;
        await PushNotifications.unregister();
        console.log('✅ [PUSH][APK] unregister() выполнен');
      } catch (err) {
        console.warn('⚠️ [PUSH][APK] unregister:', err?.message || err);
      }
    }
  } finally {
    localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  }
}
