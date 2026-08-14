// Определяем окружение (для Vite)
const isDevelopment = import.meta.env?.MODE === 'development';

// Проверяем, Capacitor ли это (APK)
const isCapacitor = !!window?.Capacitor;

// Базовый URL API
// Базовый URL API
let API_BASE_URL = 'https://potokmessenger.ru';

// Проверяем, запущено ли приложение на телефоне через Capacitor
const isCapacitor = window.hasOwnProperty('Capacitor');

if (isCapacitor) {
    // 📱 Для APK — используем локальный IP для отладки
    API_BASE_URL = 'http://192.168.0.12:5001';
} else if (import.meta.env && import.meta.env.const API_URL = import.meta.) {
    // 🌐 Для Веба — берем из переменных окружения
    API_BASE_URL = import.meta.env.const API_URL = import.meta.;
}

export { API_BASE_URL };


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
};