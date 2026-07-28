// hooks/useUnread.js
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
  console.log('🔄 resetUnread для', chatKey);
  setUnreadCounts(prev => {
    const newState = { ...prev, [chatKey]: 0 };
    console.log('📊 Новые unreadCounts:', newState);
    return newState;
  });
}, []);

  return { unreadCounts, fetchUnread, updateUnread, resetUnread };
}