import { useCallback } from 'react';
import { normalizeChatId, extractNumericId, getActiveChatData } from '../utils/chatUtils';
import { getChatIdFromMessage } from '../utils/chatUtils';
import { playNotificationSound } from '../utils/soundUtils';
import { API_BASE_URL } from '../config';
import { apiClient } from '../services/apiClient';

export function useAppHandlers({
  // Состояния
  user,
  setUser,
  activeChatId,
  setActiveChatId,
  setActiveChatData,
  setIsProfileOpen,
  setGroupChatsVersion,
  setChatsVersion,
  setChannelsVersion,
  activeChatIdRef,
  processedEvents,
  pinnedProcessingRef,
  // Хуки и их методы
  joinChat,
  resetUnread,
  loadHistory,
  channels,
  groupChats,
  chats,
  socket,
  setMessagesByChat,
  addMessage,
  setGroupChats,
  setChannels,
  setChats,
  setContacts,
  sendMessage,
  deleteMessageLocally,
  emit,
  showToast,
  addChannel,
  addGroupChat,
  removeChannel,
  removeGroupChat,
  addContact,
  // Обработчики из messageHandlers
  handleMessageDeleted,
  // ...
}) {
  // ====== ПЕРЕКЛЮЧЕНИЕ ЧАТА ======
  const handleSelectChat = useCallback(async (chatId, chatData = null) => {
    if (!chatId) return;
    const normalizedChatId = normalizeChatId(chatId);
    if (normalizedChatId === activeChatId) return;
    setActiveChatId(normalizedChatId);
    activeChatIdRef.current = normalizedChatId;
    joinChat(normalizedChatId);
    resetUnread(normalizedChatId);
    await loadHistory(normalizedChatId);
    let activeData = chatData || getActiveChatData(normalizedChatId, channels, groupChats, chats);
    setActiveChatData(activeData || { name: 'Чат', avatar: '💬', type: 'general' });
    setIsProfileOpen(false);
    if (socket) {
      socket.emit('read_messages', { activeChatId: normalizedChatId });
      setMessagesByChat(prev => {
        const newState = { ...prev };
        const chatMessages = newState[normalizedChatId];
        if (chatMessages) {
          newState[normalizedChatId] = chatMessages.map(msg =>
            msg.senderId !== user?.id ? { ...msg, status: 'read' } : msg
          );
        }
        return newState;
      });
    }
  }, [activeChatId, joinChat, resetUnread, loadHistory, channels, groupChats, chats, socket, user]);

  // ====== ОТПРАВКА СООБЩЕНИЯ ======
  const handleSendMessage = useCallback((text, mediaUrl = null, mediaType = null) => {
    if (!text && !mediaUrl) return;
    sendMessage({ text, mediaUrl, mediaType, activeChatId });
  }, [sendMessage, activeChatId]);

  // ====== УДАЛЕНИЕ СООБЩЕНИЯ ======
  const handleDeleteMessage = useCallback((msgId) => {
    deleteMessageLocally(activeChatId, msgId);
    emit('delete_message', { messageId: msgId, activeChatId });
  }, [activeChatId, deleteMessageLocally, emit]);

  // ====== ПОЛУЧЕНИЕ НОВОГО СООБЩЕНИЯ ======
  const handleReceiveMessage = useCallback((newMessage) => {
    const chatId = getChatIdFromMessage(newMessage, user?.id);
    console.log('📩 Получено сообщение для чата:', chatId, 'Сообщение:', newMessage);

    if (chatId && chatId !== 'chat_general') {
      joinChat(chatId);
    }

    const msgKey = `${chatId}_${newMessage.id}`;
    if (processedEvents.current.has(msgKey)) return;
    processedEvents.current.add(msgKey);
    setTimeout(() => processedEvents.current.delete(msgKey), 1000);

    addMessage(chatId, newMessage);

    if (chatId.startsWith('chat_')) {
      const chatDbId = parseInt(chatId.replace('chat_', ''), 10);
      setGroupChats(prev => {
        const updated = prev.map(ch => {
          const id = ch.dbId || parseInt(ch.id?.replace('chat_', ''), 10);
          if (id === chatDbId) {
            return { ...ch, lastMessage: newMessage };
          }
          return ch;
        });
        return [...updated];
      });
      setGroupChatsVersion(prev => prev + 1);
    } else if (chatId.startsWith('channel_')) {
      const channelId = parseInt(chatId.replace('channel_', ''), 10);
      setChannels(prev => {
        const updated = prev.map(ch => {
          if (ch.id === channelId) {
            return { ...ch, lastMessage: newMessage };
          }
          return ch;
        });
        setChannelsVersion(prev => prev + 1);
        return [...updated];
      });
    } else if (chatId.startsWith('user_')) {
      const userId = parseInt(chatId.replace('user_', ''), 10);
      setChats(prev => {
        const existing = prev.find(ch => {
          const id = ch.dbId || parseInt(ch.id?.replace('user_', ''), 10);
          return id === userId;
        });
        if (!existing) {
          const newChat = {
            id: `user_${userId}`,
            dbId: userId,
            name: newMessage.sender?.username || `Пользователь ${userId}`,
            avatar: newMessage.sender?.avatar || '👤',
            lastMessage: newMessage,
            unreadCount: 0,
            isOnline: false,
          };
          return [...prev, newChat];
        }
        return prev.map(ch => {
          const id = ch.dbId || parseInt(ch.id?.replace('user_', ''), 10);
          if (id === userId) {
            return { ...ch, lastMessage: newMessage };
          }
          return ch;
        });
      });
      setContacts(prev => prev.map(contact => {
        if (contact.id === userId) {
          return { ...contact, lastMessage: newMessage };
        }
        return contact;
      }));
      setChatsVersion(prev => prev + 1);
    }

    if (String(newMessage.senderId) !== String(user?.id)) {
      playNotificationSound();
    }
  }, [user, joinChat, addMessage, setGroupChats, setChannels, setChats, setGroupChatsVersion, setChannelsVersion, setChatsVersion, setContacts]);

  // ====== ЗАКРЕПЛЕНИЕ ======
  const handlePin = useCallback(async (messageId) => {
    const id = typeof messageId === 'object' ? messageId.messageId || messageId.id : messageId;
    if (!id) return;
    if (pinnedProcessingRef.current.has(id)) return;
    pinnedProcessingRef.current.add(id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/messages/${id}/pin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        let errorMsg = 'Ошибка закрепления';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          const text = await response.text();
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setMessagesByChat(prev => {
        const newState = { ...prev };
        for (const chatId in newState) {
          newState[chatId] = newState[chatId].map(msg =>
            msg.id === id ? { ...msg, isPinned: data.isPinned } : msg
          );
        }
        return newState;
      });
    } catch (error) {
      console.error('Ошибка закрепления:', error);
      if (!error.message.includes('403') && !error.message.includes('404')) {
        showToast('Не удалось закрепить сообщение: ' + error.message);
      }
    } finally {
      pinnedProcessingRef.current.delete(id);
    }
  }, [setMessagesByChat, showToast]);

  // ====== СОЗДАНИЕ КАНАЛА ======
  const handleCreateChannel = useCallback(async (channelData) => {
    try {
      const newChannel = await apiClient('/api/channels', {
        method: 'POST',
        body: JSON.stringify(channelData),
      });
      const members = await apiClient(`/api/channels/${newChannel.id}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const channelWithMembers = { ...newChannel, members };
      addChannel(channelWithMembers);
      const chatId = `channel_${newChannel.id}`;
      joinChat(chatId);
      handleSelectChat(chatId, {
        name: channelData.name,
        avatar: channelData.avatar || '📢',
        type: 'channel',
        creatorId: user?.id,
        members: members,
      });
    } catch (err) {
      console.error('❌ Ошибка создания канала:', err);
      showToast(err.message || 'Не удалось создать канал', 'error');
      throw err;
    }
  }, [addChannel, joinChat, handleSelectChat, user, showToast]);

  // ====== СОЗДАНИЕ ГРУППЫ ======
  const handleCreateGroupChat = useCallback(async (chatData) => {
    try {
      const newChat = await apiClient('/api/chats', {
        method: 'POST',
        body: JSON.stringify(chatData),
      });
      const numericId = extractNumericId(newChat.id);
      if (numericId === null) return;
      const chatId = `chat_${numericId}`;
      const normalized = { ...newChat, id: chatId, dbId: numericId };
      addGroupChat(normalized);
      joinChat(chatId);
      handleSelectChat(chatId, {
        name: chatData.name,
        avatar: chatData.avatar || '💬',
        type: 'group',
        creatorId: user?.id,
        members: [{ userId: user?.id, user: { id: user?.id, username: user?.username, avatar: user?.avatar } }]
      });
    } catch (err) {
      console.error('❌ Ошибка создания группового чата:', err);
      showToast(err.message || 'Не удалось создать групповой чат', 'error');
      throw err;
    }
  }, [addGroupChat, joinChat, handleSelectChat, user, showToast]);

  // ====== ОБНОВЛЕНИЕ ЧАТА ======
  const handleChatUpdate = useCallback((updated) => {
    if (updated.type === 'channel') {
      setChannels(prev => prev.map(ch => ch.id === updated.id ? updated : ch));
      if (activeChatId === `channel_${updated.id}`) {
        setActiveChatData(prev => ({ ...prev, name: updated.name, avatar: updated.avatar }));
      }
    } else if (updated.type === 'group') {
      setGroupChats(prev => prev.map(ch => ch.dbId === updated.id ? { ...ch, name: updated.name, avatar: updated.avatar } : ch));
      setGroupChatsVersion(prev => prev + 1);
      if (activeChatId === `chat_${updated.id}`) {
        setActiveChatData(prev => ({ ...prev, name: updated.name, avatar: updated.avatar }));
      }
    }
  }, [setChannels, setGroupChats, activeChatId, setActiveChatData]);

  // ====== ОСТАЛЬНЫЕ ОБРАБОТЧИКИ ======
  // (handleChannelCreated, handleChannelDeleted, handleChatCreated, handleChatDeleted, handleChannelMemberAdded, etc.)
  // Они пока остаются в App.jsx, потому что их много и они сложные

  // ====== ВЫХОД ======
  const handleLogout = useCallback(() => {
    if (socket) socket.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setActiveChatId(null);
  }, [socket]);

  return {
    handleSelectChat,
    handleSendMessage,
    handleDeleteMessage,
    handleReceiveMessage,
    handlePin,
    handleCreateChannel,
    handleCreateGroupChat,
    handleChatUpdate,
    handleLogout,
    // ... остальные обработчики
  };
}