// hooks/useMarkAsRead.js
import { useRef, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

export function useMarkAsRead() {
  const pending = useRef(new Set());
  const timeoutRef = useRef(null);

  const mark = useCallback(async (type, id) => {
    const key = `${type}_${id}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    try {
      await apiClient('/api/read', {
        method: 'POST',
        body: JSON.stringify({ type, id }),
      });
    } catch (err) {
      console.error('markAsRead error:', err);
    } finally {
      setTimeout(() => pending.current.delete(key), 500);
    }
  }, []);

  const debouncedMark = useCallback((type, id) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      mark(type, id);
    }, 300);
  }, [mark]);

  return { markAsRead: mark, debouncedMarkAsRead: debouncedMark };
}