
import { useCallback } from 'react';
import { normalizeChatId, extractNumericId, getActiveChatData, getChatType } from '../utils/chatUtils';
import { getChatIdFromMessage } from '../utils/chatUtils';
import { playNotificationSound } from '../utils/soundUtils';
import { API_BASE_URL } from '../config';
import { apiClient } from '../services/apiClient';
import { unregisterPush } from '../services/pushRegistration';

export function useMessageHandlers({
  // Основные
  setMessagesByChat,
  setChats,
  setChannels,
  setGroupChats,
  setChatsVersion,
  setChannelsVersion,
  setGroupChatsVersion,
  setActiveChatId,
  setActiveChatData,
  setIsProfileOpen,
  reloadChats,
  user,
  setUser,
  activeChatData,
  activeChatIdRef,
  updateUnread,
  loadHistory,
  processedEvents,
  setContacts,
  setContactsVersion,
  fetchContacts,
  // New
  joinChat,
  resetUnread,
  channels,
  groupChats,
  chats,
  contacts,
  socket,
  sendMessage,
  deleteMessageLocally,
  emit,
  showToast,
  addChannel,
  addGroupChat,
  removeChannel,
  removeGroupChat,
  addContact,
  addMessage,
  pinnedProcessingRef,
  activeChatId,
}) {

  // ====== 1. ПЕРЕКЛЮЧЕНИЕ ЧАТА ======
  const handleSelectChat = useCallback(async (chatId, chatData = null) => {
    if (!chatId) return;
    const normalizedChatId = normalizeChatId(chatId);
    if (normalizedChatId === activeChatId) return;
    setActiveChatId(normalizedChatId);
    activeChatIdRef.current = normalizedChatId;
    joinChat(normalizedChatId);
    resetUnread(normalizedChatId);
    await loadHistory(normalizedChatId);
    let activeData = chatData || getActiveChatData(normalizedChatId, channels, groupChats, chats, contacts);
    setActiveChatData(activeData || { name: 'Чат', avatar: '💬', type: getChatType(normalizedChatId) || 'private' });
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
  }, [activeChatId, joinChat, resetUnread, loadHistory, channels, groupChats, chats, contacts, socket, user, setActiveChatId, activeChatIdRef, setActiveChatData, setIsProfileOpen, setMessagesByChat]);

  // ====== 2. СОЗДАНИЕ КАНАЛА ======
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

  // ====== 3. СОЗДАНИЕ ГРУППЫ ======
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

  // ====== 4. ОТПРАВКА СООБЩЕНИЯ ======
  const handleSendMessage = useCallback((text, mediaUrl = null, mediaType = null) => {
    if (!text && !mediaUrl) return;
    sendMessage({ text, mediaUrl, mediaType, activeChatId });
  }, [sendMessage, activeChatId]);

  // ====== 5. УДАЛЕНИЕ СООБЩЕНИЯ ======
  const handleDeleteMessage = useCallback((msgId) => {
    deleteMessageLocally(activeChatId, msgId);
    emit('delete_message', { messageId: msgId, activeChatId });
  }, [activeChatId, deleteMessageLocally, emit]);

  // ====== 6. ПОЛУЧЕНИЕ НОВОГО СООБЩЕНИЯ ======
  const handleReceiveMessage = useCallback((newMessage) => {
    const chatId = getChatIdFromMessage(newMessage, user?.id);
    if (!chatId) return;

    if (chatId) {
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
      setContactsVersion(prev => prev + 1);
    }

    if (String(newMessage.senderId) !== String(user?.id)) {
      const muted =
        (chatId.startsWith('user_') && (
          contacts?.find((c) => String(c.id) === String(chatId.replace('user_', '')))?.muted
          || chats?.find((c) => c.id === chatId || String(c.dbId) === String(chatId.replace('user_', '')))?.muted
        ))
        || (chatId.startsWith('channel_') && channels?.find((ch) => String(ch.id) === String(chatId.replace('channel_', '')))?.muted)
        || (chatId.startsWith('chat_') && groupChats?.find((g) => g.id === chatId || String(g.dbId) === String(chatId.replace('chat_', '')))?.muted);

      if (!muted && (typeof document === 'undefined' || !document.hidden)) {
        playNotificationSound();
      }
    }
  }, [user, joinChat, addMessage, setGroupChats, setChannels, setChats, setGroupChatsVersion, setChannelsVersion, setChatsVersion, setContacts, setContactsVersion, contacts, chats, channels, groupChats]);

  // ====== 7. ЗАКРЕПЛЕНИЕ ======
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

  // ====== 8. ОБНОВЛЕНИЕ ЧАТА ======
  const handleChatUpdate = useCallback((updated) => {
    if (updated.type === 'channel') {
      setChannels(prev => prev.map(ch => ch.id === updated.id ? updated : ch));
      setChannelsVersion(prev => prev + 1);
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
  }, [setChannels, setGroupChats, setChannelsVersion, setGroupChatsVersion, activeChatId, setActiveChatData]);

  // ====== 9. ВЫХОД ======
  const handleLogout = useCallback(async () => {
    const token = localStorage.getItem('token');
    try {
      await unregisterPush();
    } catch (err) {
      console.warn('⚠️ [PUSH] Ошибка при logout:', err);
    }
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (_) {}
    }
    if (socket) socket.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setActiveChatId(null);
  }, [socket, setUser, setActiveChatId]);

  // ====== 10. ОСТАЛЬНЫЕ (из messageHandlers) ======
  const handleReactionUpdated = useCallback(({ messageId, reactions }) => {
    setMessagesByChat(prev => {
      const newState = { ...prev };
      for (const chatId in newState) {
        newState[chatId] = newState[chatId].map(msg =>
          msg.id === messageId ? { ...msg, reactions } : msg
        );
      }
      return newState;
    });
  }, [setMessagesByChat]);

  const handleThreadCreated = useCallback(({ thread, messageId }) => {
    setMessagesByChat(prev => {
      const newState = { ...prev };
      for (const chatId in newState) {
        newState[chatId] = newState[chatId].map(msg =>
          msg.id === messageId ? { ...msg, threads: [...(msg.threads || []), thread] } : msg
        );
      }
      return newState;
    });
  }, [setMessagesByChat]);

  const handleMessageEdited = useCallback(({ messageId, text }) => {
    setMessagesByChat(prev => {
      const newState = { ...prev };
      for (const chatId in newState) {
        newState[chatId] = newState[chatId].map(msg =>
          msg.id === messageId ? { ...msg, text, edited: true } : msg
        );
      }
      return newState;
    });
  }, [setMessagesByChat]);

  
const handleMessageDeleted = useCallback(({ messageId, activeChatId, otherUserId, senderId, receiverId }) => {
    // Теперь senderId и receiverId доступны
    console.log(' [handleMessageDeleted] activeChatId:', activeChatId);
    console.log(' [handleMessageDeleted] messageId:', messageId);
    console.log(' [handleMessageDeleted] otherUserId:', otherUserId);
    console.log(' [handleMessageDeleted] senderId:', senderId);
    console.log(' [handleMessageDeleted] receiverId:', receiverId);
    
    if (!activeChatId) {
        console.log(' [handleMessageDeleted] Нет activeChatId');
        return;
    }

    let newLastMessage = null;

    setMessagesByChat(prev => {
        const newState = { ...prev };
        for (const chatId in newState) {
            newState[chatId] = newState[chatId].map(msg =>
                msg.id === messageId
                    ? { ...msg, isDeleted: true, text: 'Сообщение удалено', mediaUrl: null, mediaType: null, reactions: [], threads: [] }
                    : msg
            );
        }
        if (newState[activeChatId]) {
            const lastValid = newState[activeChatId]
                .filter(msg => !msg.isDeleted)
                .pop();
            newLastMessage = lastValid || null;
        }
        return newState;
    });

    if (newLastMessage === null) {
        newLastMessage = {
            id: messageId,
            isDeleted: true,
            text: 'Сообщение удалено',
            mediaUrl: null,
            mediaType: null,
            createdAt: new Date().toISOString(),
            sender: { id: null, username: 'Unknown' }
        };
    }

    // Обновляем сайдбар
    if (activeChatId.startsWith('channel_')) {
        setChannels(prev => prev.map(ch => {
            if (`channel_${ch.id}` === activeChatId) {
                return { ...ch, lastMessage: newLastMessage };
            }
            return ch;
        }));
        setChannelsVersion(prev => prev + 1);
    } else if (activeChatId.startsWith('chat_')) {
        setGroupChats(prev => prev.map(ch => {
            if (ch.id === activeChatId) {
                return { ...ch, lastMessage: newLastMessage };
            }
            return ch;
        }));
        setGroupChatsVersion(prev => prev + 1);

} else if (activeChatId.startsWith('user_')) {
    const currentUserId = user?.id;
    let userIdToUpdate;

    if (senderId && receiverId) {
        // Если удаляющий — текущий пользователь, то обновляем собеседника
        userIdToUpdate = senderId === currentUserId ? receiverId : senderId;
    } else {
        // fallback
        userIdToUpdate = otherUserId || parseInt(activeChatId.replace('user_', ''), 10);
    }

    console.log(' [handleMessageDeleted] Обновляю приватный чат для userId:', userIdToUpdate);

    setChats(prev => {
        const updated = prev.map(ch => {
            const chUserId = parseInt(ch.id?.replace('user_', ''), 10);
            if (chUserId === userIdToUpdate) {
                return { ...ch, lastMessage: newLastMessage };
            }
            return ch;
        });
        return updated;
    });
    setChatsVersion(prev => prev + 1);

    if (setContacts) {
        setContacts(prev => {
            const updated = prev.map(contact => {
                if (contact.id === userIdToUpdate) {
                    return { ...contact, lastMessage: newLastMessage };
                }
                return contact;
            });
            return updated;
        });
        setContactsVersion(prev => prev + 1);
    }
}
}, [setMessagesByChat, setChats, setChannels, setGroupChats, setChatsVersion, setChannelsVersion, setGroupChatsVersion, setContacts, setContactsVersion]);
  const handleUserUpdated = useCallback((data) => {
    const { userId, username, avatar } = data;
    console.log(' [user_updated] Получено:', data);

    if (userId === user?.id) {
      const updatedUser = { ...user, username, avatar };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }

    setChats(prev => prev.map(ch => {
      if (ch.dbId === userId) {
        return { ...ch, name: username, avatar: avatar || ch.avatar };
      }
      return ch;
    }));

    setGroupChats(prev => prev.map(chat => ({
      ...chat,
      members: chat.members?.map(m => {
        if (m.userId === userId) {
          return { ...m, user: { ...m.user, username, avatar } };
        }
        return m;
      })
    })));

    setChannels(prev => prev.map(channel => ({
      ...channel,
      members: channel.members?.map(m => {
        if (m.userId === userId) {
          return { ...m, user: { ...m.user, username, avatar } };
        }
        return m;
      })
    })));

    if (setContacts) {
      setContacts(prev => prev.map(contact => {
        if (contact.id === userId) {
          return { ...contact, username, avatar: avatar || contact.avatar };
        }
        return contact;
      }));
      if (setContactsVersion) setContactsVersion(prev => prev + 1);
    }

    if (activeChatData && activeChatData.type === 'private' && activeChatData.dbId === userId) {
      setActiveChatData(prev => ({
        ...prev,
        name: username,
        avatar: avatar || prev.avatar
      }));
    }

    setChatsVersion(prev => prev + 1);
    setGroupChatsVersion(prev => prev + 1);
    setChannelsVersion(prev => prev + 1);
  }, [user, setUser, setChats, setGroupChats, setChannels, activeChatData, setActiveChatData, setChatsVersion, setGroupChatsVersion, setChannelsVersion, setContacts, setContactsVersion]);

  const handleKickedFromChannel = useCallback(({ channelId }) => {
    showToast(` Вас удалили из канала ${channelId}`);
    setChannels(prev => prev.filter(ch => ch.id !== channelId));
    if (activeChatIdRef?.current === `channel_${channelId}`) {
      setActiveChatId(null);
      setActiveChatData(null);
      setMessagesByChat(prev => {
        const newState = { ...prev };
        delete newState[`channel_${channelId}`];
        return newState;
      });
    }
  }, [setChannels, setActiveChatId, setActiveChatData, setMessagesByChat, activeChatIdRef]);

  const handleMessagePinned = useCallback(({ messageId, isPinned }) => {
    setMessagesByChat(prev => {
      const newState = { ...prev };
      for (const chatId in newState) {
        newState[chatId] = newState[chatId].map(msg =>
          msg.id === messageId ? { ...msg, isPinned } : msg
        );
      }
      return newState;
    });
  }, [setMessagesByChat]);

  const handleUnreadUpdated = useCallback((data) => {
    const { type, id, count } = data;
    let chatKey;
    if (type === 'channel') chatKey = `channel_${id}`;
    else if (type === 'chat') chatKey = `chat_${id}`;
    else if (type === 'private') chatKey = `user_${id}`;

    const currentActive = activeChatIdRef?.current;
    console.log(' [handleUnreadUpdated] chatKey:', chatKey, 'active:', currentActive, 'count:', count);

    if (chatKey === currentActive && currentActive !== null) {
      console.log(' Сбрасываю unread для активного чата:', chatKey);
      updateUnread(chatKey, 0);
    } else {
      updateUnread(chatKey, count);
    }
  }, [updateUnread, activeChatIdRef]);

  const handleMessagesReadUpdate = useCallback(({ activeChatId: readChatId, readerId }) => {
    if (Number(readerId) === Number(user?.id)) return;
    console.log(' [handleMessagesReadUpdate] Чат:', readChatId, 'Прочитал:', readerId);

    setMessagesByChat(prev => {
      const newState = { ...prev };
      for (const chatId in newState) {
        if (chatId === readChatId) {
          newState[chatId] = newState[chatId].map(msg => {
            if (Number(msg.senderId) === Number(user?.id)) {
              return { ...msg, status: 'read' };
            }
            return msg;
          });
          break;
        }
      }
      return newState;
    });
  }, [setMessagesByChat, user]);

  return {
    handleReactionUpdated,
    handleThreadCreated,
    handleMessageEdited,
    handleMessageDeleted,
    handleUserUpdated,
    handleKickedFromChannel,
    handleMessagePinned,
    handleUnreadUpdated,
    handleMessagesReadUpdate,
    handleSelectChat,
    handleSendMessage,
    handleDeleteMessage,
    handleReceiveMessage,
    handlePin,
    handleCreateChannel,
    handleCreateGroupChat,
    handleChatUpdate,
    handleLogout,
  };
}