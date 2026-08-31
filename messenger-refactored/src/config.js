/**
 * Единственный конфиг фронта.
 * Прод / release APK: https://potokmessenger.ru
 * Локально: раскомментируй VITE_API_URL в .env.local
 */
import { Capacitor } from '@capacitor/core';

const isDevelopment = import.meta.env.DEV;

const isNativeApp = Capacitor.isNativePlatform();

let API_BASE_URL = 'https://potokmessenger.ru';

if (import.meta.env?.VITE_API_URL) {
    API_BASE_URL = String(import.meta.env.VITE_API_URL).replace(/\/$/, '');
}

if (typeof window !== 'undefined' && isDevelopment) {
    console.log('🔧 [config] API_BASE_URL =', API_BASE_URL, '| native =', isNativeApp);
}

export const SUPPORT_EMAIL = 'mesengrpotok@gmail.com';
export const LEGAL_PAGES = {
  terms: { title: 'Пользовательское соглашение', path: '/terms.html' },
  privacy: { title: 'Политика конфиденциальности', path: '/privacy-policy.html' },
};

/** Android APK с сайта (не сторы). Файл кладётся на Nginx как /potok.apk */
export const APK_DOWNLOAD = {
  url: '/potok.apk',
  filename: 'potok.apk',
  versionName: '1.0.1',
};

export { API_BASE_URL, isDevelopment, isNativeApp };

export const CHAT_IDS = {
  GENERAL: 'chat_general',
  GENERAL_ALT: 'general',
  CHANNEL_PREFIX: 'channel_',
  USER_PREFIX: 'user_',
};

export const SCROLL_CONFIG = {
  MAX_CHECKS: 20,
  CHECK_INTERVAL: 50,
  TIMEOUT: 2000,
  BOTTOM_THRESHOLD: 200,
  TOP_THRESHOLD: 40,
};

export const MEDIA_TYPES = {
  AUDIO: ['mp3', 'mp4', 'webm', 'aac', 'wav', 'ogg'],
  IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
};

export default {
  API_BASE_URL,
  CHAT_IDS,
  SCROLL_CONFIG,
  MEDIA_TYPES,
  isDevelopment,
  isNativeApp,
};
