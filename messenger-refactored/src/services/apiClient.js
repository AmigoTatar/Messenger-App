
import { API_BASE_URL } from '../config';

export const apiClient = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const usedToken = token;
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const preview = (await response.text()).slice(0, 80);
    throw new Error(
      `Ожидали JSON с API, получили не-JSON (${response.status}) с ${url}. ` +
      `Проверь VITE_API_URL / что сервер на :5001 запущен. Preview: ${preview}`
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.error || (Array.isArray(error.errors) ? error.errors[0] : null) || `HTTP ${response.status}`;
    if (
      response.status === 401 ||
      (response.status === 403 && /токен/i.test(message))
    ) {
      const current = localStorage.getItem('token');
      if (current && usedToken && current === usedToken) {
        window.dispatchEvent(new CustomEvent('potok-auth-expired', { detail: { message } }));
      }
    }
    throw new Error(message);
  }
  return response.json();
};
