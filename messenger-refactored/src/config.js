// 1. Проверяем режим разработки (Vite автоматически прописывает import.meta.env.DEV)
const isDevelopment = import.meta.env.DEV;

// 2. Нативный APK (не веб с подключённым Capacitor bridge)
const isNativeApp =
    typeof window !== 'undefined' &&
    !!window.Capacitor?.isNativePlatform?.();

// 3. Базовый URL API — APK и прод-веб ходят на один хост (без split-brain с push-token)
let API_BASE_URL = 'https://potokmessenger.ru';

if (import.meta.env?.VITE_API_URL) {
    // Явный override (локальная отладка): VITE_API_URL=http://192.168.0.12:5001
    API_BASE_URL = import.meta.env.VITE_API_URL;
}

export { API_BASE_URL, isDevelopment, isNativeApp }; 


// Остальные константы
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