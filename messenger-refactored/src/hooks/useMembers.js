// src/hooks/useMembers.js
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

export function useMembers(activeChat, socketRef) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  const fetchMembers = useCallback(async () => {
    if (!activeChat) return;
    const chatId = activeChat.id;
    const type = activeChat.type;
    setLoading(true);
    try {
      let endpoint;
      if (type === 'channel') {
        endpoint = `/api/channels/${chatId.replace('channel_', '')}/members`;
      } else if (type === 'group') {
        endpoint = `/api/chats/${chatId.replace('chat_', '')}/members`;
      } else {
        setMembers([]);
        return;
      }
      const data = await apiClient(endpoint);
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching members:', err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [activeChat]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const addMember = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const chatId = activeChat.id;
      const type = activeChat.type;
      let endpoint;
      if (type === 'channel') {
        endpoint = `/api/channels/${chatId.replace('channel_', '')}/members`;
      } else if (type === 'group') {
        endpoint = `/api/chats/${chatId.replace('chat_', '')}/members`;
      } else {
        throw new Error('Unsupported chat type');
      }
      const newMember = await apiClient(endpoint, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      setMembers(prev => {
        if (prev.some(m => m.userId === newMember.userId)) return prev;
        return [...prev, newMember];
      });
      // Отправить событие через сокет, если нужно
      if (socketRef?.current) {
        socketRef.current.emit('add_member', {
          chatId: chatId,
          userId,
          chatType: type,
        });
      }
    } catch (err) {
      console.error('Error adding member:', err);
      throw err;
    }
  }, [activeChat, socketRef]);

  const removeMember = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const chatId = activeChat.id;
      const type = activeChat.type;
      let endpoint;
      if (type === 'channel') {
        endpoint = `/api/channels/${chatId.replace('channel_', '')}/members/${userId}`;
      } else if (type === 'group') {
        endpoint = `/api/chats/${chatId.replace('chat_', '')}/members/${userId}`;
      } else {
        throw new Error('Unsupported chat type');
      }
      await apiClient(endpoint, { method: 'DELETE' });
      setMembers(prev => prev.filter(m => m.userId !== userId));
      // Отправить событие через сокет, если нужно
      if (socketRef?.current) {
        socketRef.current.emit('remove_member', {
          chatId: chatId,
          userId,
          chatType: type,
        });
      }
    } catch (err) {
      console.error('Error removing member:', err);
      throw err;
    }
  }, [activeChat, socketRef]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const data = await apiClient('/api/users');
      setAllUsers(data);
    } catch (err) {
      console.error('Error fetching all users:', err);
    }
  }, []);

  return {
    members,
    loading,
    allUsers,
    fetchMembers,
    addMember,
    removeMember,
    fetchAllUsers,
  };
}