// src/utils/dateUtils.js

/**
 * Форматирует дату в локальное время (часы:минуты)
 */
export const formatTime = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

/**
 * Форматирует дату в полный формат (день/месяц/год часы:минуты)
 */
export const formatFullDate = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return d.toLocaleString([], { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch {
    return '';
  }
};