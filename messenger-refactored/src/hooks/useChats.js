// hooks/useChats.js
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

export function useChats(user) {
  const [chats, setChats] = useState([]);       // приватные
  const [channels, setChannels] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [usersData, channelsData, groupsData] = await Promise.all([
        apiClient('/api/users'),
        apiClient('/api/channels'),
        apiClient('/api/chats'),
      ]);
      setChats(Array.isArray(usersData) ? usersData : []);
      // Для каналов загружаем участников
      if (Array.isArray(channelsData)) {
        const channelsWithMembers = await Promise.all(
          channelsData.map(async (channel) => {
            try {
              const members = await apiClient(`/api/channels/${channel.id}/members`);
              return { ...channel, members };
            } catch {
              return { ...channel, members: [] };
            }
          })
        );
        setChannels(channelsWithMembers);
      } else {
        setChannels([]);
      }
      setGroupChats(Array.isArray(groupsData) ? groupsData : []);
    } catch (err) {
      console.error('Error loading chats:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

 const addChannel = useCallback((channel) => {
  setChannels(prev => {
    // Проверяем, что канала ещё нет
    const exists = prev.some(ch => ch.id === channel.id || ch.id === `channel_${channel.id}`);
    if (exists) return prev;
    return [...prev, { ...channel, members: [] }];
  });
}, [setChannels]);

 const addGroupChat = useCallback((chat) => {
  setGroupChats(prev => {
    // Проверяем, есть ли уже группа с таким id
    const exists = prev.some(c => c.id === chat.id || c.dbId === chat.dbId);
    if (exists) return prev;
    return [...prev, chat];
  });
}, [setGroupChats]);

  const removeChannel = useCallback((channelId) => {
    setChannels(prev => prev.filter(ch => ch.id !== channelId));
  }, []);

  const removeGroupChat = useCallback((chatId) => {
    setGroupChats(prev => prev.filter(ch => ch.dbId !== chatId && ch.id !== `chat_${chatId}`));
  }, []);

  return {
    chats,
    channels,
    groupChats,
    loading,
    reload: loadAll,
    addChannel,
    addGroupChat,
    removeChannel,
    setChannels,
    setGroupChats,
    removeGroupChat, 
    setChats, 
  };
}