
import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

export function useUnread(user) {
  const [unreadCounts, setUnreadCounts] = useState({});

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiClient('/api/unread');
      setUnreadCounts(data);
    } catch (err) {
      console.error('Error fetching unread:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

 // hooks/useUnread.js
const updateUnread = useCallback((chatKey, count) => {
    setUnreadCounts(prev => ({
        ...prev,
        [chatKey]: Math.max(count, 0) // ← УСТАНАВЛИВАЕМ, а не прибавляем!
    }));
}, []);

  const resetUnread = useCallback((chatKey) => {
  setUnreadCounts(prev => ({ ...prev, [chatKey]: 0 }));
}, []);

  const clearUnread = useCallback(() => {
    setUnreadCounts({});
  }, []);

  return { unreadCounts, fetchUnread, updateUnread, resetUnread, clearUnread };
}