import React, { useState, useEffect, useRef, useCallback } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar/Sidebar';
import ChatArea from './components/ChatArea/ChatArea';
import ProfilePanel from './components/ProfilePanel/ProfilePanel';
import Auth from './Auth';
import SearchModal from './components/SearchModal';
import { useMessageHandlers } from './hooks/useMessageHandlers';
import { useSocket } from './hooks/useSocket';
import { useMessages } from './hooks/useMessages';
import { useChats } from './hooks/useChats';
import { useUnread } from './hooks/useUnread';
import { useMarkAsRead } from './hooks/useMarkAsRead';
import { useTheme } from './hooks/useTheme';
import { getChatIdFromMessage } from './utils/chatUtils';
import { playNotificationSound } from './utils/soundUtils';
import { API_BASE_URL } from './config';
import { apiClient } from './services/apiClient';
import { MessageContext } from './contexts/MessageContext';
import { useToast } from './hooks/useToast';
import Toast from '/src/Toast';

export default function App() {
  // === Пользователь ===
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChatData, setActiveChatData] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [groupChatsVersion, setGroupChatsVersion] = useState(0);
  const [chatsVersion, setChatsVersion] = useState(0);
  const [channelsVersion, setChannelsVersion] = useState(0);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isNewChannelOpen, setIsNewChannelOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // === Хуки ===
  const { isDarkMode, toggleTheme } = useTheme();
  const { chats, channels, groupChats, addChannel, addGroupChat, removeChannel, removeGroupChat, setChannels, setGroupChats, setChats, reload: reloadChats, loading: chatsLoading } = useChats(user);
  const { unreadCounts, fetchUnread, updateUnread, resetUnread } = useUnread(user);
 const { getMessages, addMessage, addMessages, loadHistory, hasMore, loading, markMessageAsRead, deleteMessageLocally, setMessagesByChat } = useMessages(user?.id);
  const { markAsRead, debouncedMarkAsRead } = useMarkAsRead();
  

  // === Рефы ===
  const processedEvents = useRef(new Set());
  const activeChatIdRef = useRef(activeChatId);
  const pinnedProcessingRef = useRef(new Set());

  // === Сокет ===
  const { socket, emit, joinChat, sendMessage } = useSocket(user, {});
  

  // === Обработчики из хука ===
  const messageHandlers = useMessageHandlers({
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
    processedEvents
  });

  const {
    handleReactionUpdated,
    handleThreadCreated,
    handleMessageEdited,
    handleMessageDeleted,
    handleUserUpdated,
    handleKickedFromChannel,
    handleMessagePinned,
    handleUnreadUpdated,
    handleMessagesReadUpdate
  } = messageHandlers;

  const { toast, showToast, hideToast } = useToast();
  // === Эффекты ===
  useEffect(() => {
    if (!activeChatId) return;
    let found = false;
    if (activeChatId.startsWith('channel_')) {
      const channel = channels.find(c => `channel_${c.id}` === activeChatId);
      if (channel) {
        setActiveChatData({ name: channel.name, avatar: channel.avatar, type: 'channel', creatorId: channel.creatorId, members: channel.members || [] });
        found = true;
      }
    } else if (activeChatId.startsWith('chat_')) {
      const group = groupChats.find(c => c.id === activeChatId || `chat_${c.dbId}` === activeChatId);
      if (group) {
        setActiveChatData({ name: group.name, avatar: group.avatar, type: 'group', creatorId: group.creatorId, members: group.members || [] });
        found = true;
      }
    } else if (activeChatId.startsWith('user_')) {
      const user = chats.find(c => c.id === activeChatId);
      if (user) {
        setActiveChatData({ name: user.name, avatar: user.avatar, type: 'private', dbId: user.dbId });
        found = true;
      }
    }
    if (!found) {
      console.log('🔄 Чат не найден, сбрасываю activeChatId');
      setActiveChatId(null);
      setActiveChatData(null);
    }
  }, [activeChatId, channels, groupChats, chats]);

useEffect(() => {
    if (socket) {
        socket.on('connect', () => setIsSocketConnected(true));
        socket.on('disconnect', () => setIsSocketConnected(false));
        return () => {
            socket.off('connect');
            socket.off('disconnect');
        };
    }
}, [socket]);


  useEffect(() => {
    if (!socket || !socket.connected) return;
    groupChats.forEach(chat => {
      const chatId = chat.id || `chat_${chat.dbId}`;
      if (chatId) {
        socket.emit('join_chat', chatId);
        console.log('📡 Подписываюсь на группу:', chatId);
      }
    });
    channels.forEach(channel => {
      const chatId = `channel_${channel.id}`;
      socket.emit('join_chat', chatId);
      console.log('📡 Подписываюсь на канал:', chatId);
    });
    chats.forEach(chat => {
      if (chat.id && chat.id !== 'chat_general' && !chat.id.startsWith('channel_') && !chat.id.startsWith('chat_')) {
        socket.emit('join_chat', chat.id);
      }
    });
  }, [socket, groupChats, channels, chats]);

  // ==============================================
// ⌨️ ВЫХОД ИЗ ЧАТА ПО ESCAPE
// ==============================================
useEffect(() => {
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      // Если открыт профиль — закрываем его
      if (isProfileOpen) {
        setIsProfileOpen(false);
        return;
      }
      
      // Если есть активный чат — закрываем его
      if (activeChatId) {
        setActiveChatId(null);
        setActiveChatData(null);
        activeChatIdRef.current = null;
      }
    }
  };
  
  window.addEventListener('keydown', handleEsc);
  return () => window.removeEventListener('keydown', handleEsc);
}, [activeChatId, isProfileOpen]);

  // === Обработчики ===
  const handleChannelCreated = useCallback(async (newChannel) => {
    const rawId = String(newChannel.id);
    const numericId = parseInt(rawId.replace(/^channel_/, '').replace(/^chat_/, '').replace(/^user_/, ''), 10);
    addChannel({ ...newChannel, id: numericId, members: [] });
    const idWithPrefix = `channel_${numericId}`;
    joinChat(idWithPrefix);
    try {
      const token = localStorage.getItem('token');
      const members = await apiClient(`/api/channels/${numericId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChannels(prev => prev.map(ch =>
        String(ch.id) === String(numericId) || ch.id === idWithPrefix
          ? { ...ch, members }
          : ch
      ));
    } catch (err) {
      console.error('Ошибка загрузки участников нового канала:', err);
    }
  }, [addChannel, joinChat, setChannels]);

  const handleChannelDeleted = useCallback(({ channelId }) => {
    console.log('🗑️ [handleChannelDeleted] channelId:', channelId);
    removeChannel(channelId);
    const activeId = activeChatIdRef.current;
    if (activeId === `channel_${channelId}` || activeId === channelId || activeId === String(channelId)) {
      setActiveChatId(null);
      setActiveChatData(null);
      setMessagesByChat(prev => {
        const newState = { ...prev };
        delete newState[`channel_${channelId}`];
        return newState;
      });
      setIsProfileOpen(false);
    }
  }, [removeChannel, setActiveChatId, setActiveChatData, setMessagesByChat, setIsProfileOpen]);

  const handleChatDeleted = useCallback(({ chatId }) => {
    console.log('🗑️ [handleChatDeleted] chatId:', chatId);
    removeGroupChat(chatId);
    const activeId = activeChatIdRef.current;
    if (activeId === `chat_${chatId}` || activeId === chatId || activeId === String(chatId)) {
      setActiveChatId(null);
      setActiveChatData(null);
      setMessagesByChat(prev => {
        const newState = { ...prev };
        delete newState[`chat_${chatId}`];
        return newState;
      });
      setIsProfileOpen(false);
    }
  }, [removeGroupChat, setActiveChatId, setActiveChatData, setMessagesByChat, setIsProfileOpen]);

  const handleChatCreated = useCallback((newChat) => {
    console.log('🆕 [handleChatCreated] ВЫЗВАНА! newChat:', newChat);
    const rawId = String(newChat.id);
    const numericId = rawId.replace(/^chat_/, '').replace(/^channel_/, '').replace(/^user_/, '');
    const idWithPrefix = `chat_${numericId}`;
    const normalized = { ...newChat, id: idWithPrefix, dbId: parseInt(numericId, 10) };
    addGroupChat(normalized);
    joinChat(idWithPrefix);
    console.log('🆕 [handleChatCreated] Вызван joinChat для', idWithPrefix);
  }, [addGroupChat, joinChat]);

 const handleReceiveMessage = useCallback((newMessage) => {
    const chatId = getChatIdFromMessage(newMessage, user?.id);
    console.log('📩 Получено сообщение для чата:', chatId, 'Сообщение:', newMessage);

    if (chatId && chatId !== 'chat_general') {
        joinChat(chatId);
        console.log('📡 Подписываюсь на комнату из сообщения:', chatId);
    }

    const msgKey = `${chatId}_${newMessage.id}`;
    if (processedEvents.current.has(msgKey)) return;
    processedEvents.current.add(msgKey);
    setTimeout(() => processedEvents.current.delete(msgKey), 1000);

    // ✅ ТОЛЬКО ОДИН РАЗ ДОБАВЛЯЕМ СООБЩЕНИЕ
    addMessage(chatId, newMessage);

    // Обновление lastMessage
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
        // ✅ ЗДЕСЬ НЕТ addMessage — ОН УЖЕ БЫЛ ВЫЗВАН ВЫШЕ
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
        setChatsVersion(prev => prev + 1);
    }

    if (String(newMessage.senderId) !== String(user?.id)) {
        playNotificationSound();
    }
}, [user, joinChat, addMessage, setGroupChats, setChannels, setChats, setGroupChatsVersion, setChannelsVersion, setChatsVersion]);

  const handlePin = useCallback(async (messageId) => {
    const id = typeof messageId === 'object' ? messageId.messageId || messageId.id : messageId;
    if (!id) return;
    if (pinnedProcessingRef.current.has(id)) return;
    pinnedProcessingRef.current.add(id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/messages/${id}/pin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
  }, [setMessagesByChat]);

  const handleChannelMemberAdded = useCallback((data) => {
    setChannels(prev => {
      const updated = prev.map(ch => {
        if (ch.id === data.channelId) {
          const exists = ch.members?.some(m => m.userId === data.member.userId);
          if (exists) return ch;
          return { ...ch, members: [...(ch.members || []), data.member] };
        }
        return ch;
      });
      return [...updated];
    });
    setChannelsVersion(prev => prev + 1);
    if (activeChatId === `channel_${data.channelId}`) {
      setActiveChatData(prev => ({
        ...prev,
        members: [...(prev?.members || []), data.member]
      }));
    }
    if (data.member?.userId === user?.id) {
      joinChat(`channel_${data.channelId}`);
    }
  }, [setChannels, setActiveChatData, user, joinChat, activeChatId]);

  const handleChannelMemberRemoved = useCallback((data) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id === data.channelId) {
        return { ...ch, members: ch.members?.filter(m => m.userId !== data.userId) || [] };
      }
      return ch;
    }));
    if (data.userId === user?.id) {
      removeChannel(data.channelId);
      if (activeChatIdRef.current === `channel_${data.channelId}`) {
        setActiveChatId('chat_general');
        setActiveChatData({ name: 'Общий чат', avatar: '💬', type: 'general' });
      }
    }
  }, [setChannels, user, removeChannel, setActiveChatId, setActiveChatData]);

  const handleChatMemberAdded = useCallback((data) => {
    console.log('🔥🔥🔥 Событие chat_member_added пришло!', data);
    if (data.chatData) {
      setGroupChats(prev => {
        const exists = prev.some(ch => ch.dbId === data.chatData.id || ch.id === `chat_${data.chatData.id}`);
        if (exists) {
          return prev.map(ch => {
            if (ch.dbId === data.chatData.id || ch.id === `chat_${data.chatData.id}`) {
              return {
                ...ch,
                name: data.chatData.name,
                avatar: data.chatData.avatar,
                members: data.chatData.members || [],
                lastMessage: data.chatData.lastMessage || null,
                creatorId: data.chatData.creatorId
              };
            }
            return ch;
          });
        } else {
          const newGroup = {
            id: `chat_${data.chatData.id}`,
            dbId: data.chatData.id,
            name: data.chatData.name,
            avatar: data.chatData.avatar,
            members: data.chatData.members || [],
            lastMessage: data.chatData.lastMessage || null,
            creatorId: data.chatData.creatorId,
          };
          return [...prev, newGroup];
        }
      });
      if (activeChatId === `chat_${data.chatData.id}`) {
        setActiveChatData(prev => ({
          ...prev,
          name: data.chatData.name,
          avatar: data.chatData.avatar,
          members: data.chatData.members || []
        }));
      }
      setGroupChatsVersion(prev => prev + 1);
      return;
    }
    // fallback
    setGroupChats(prev => {
      let updated = [...prev];
      const exists = updated.some(ch => ch.dbId === data.chatId || ch.id === `chat_${data.chatId}`);
      if (!exists) {
        const newGroup = {
          id: `chat_${data.chatId}`,
          dbId: data.chatId,
          name: data.chatName || 'Групповой чат',
          avatar: data.chatAvatar || '💬',
          members: data.member ? [data.member] : [],
          lastMessage: null,
          creatorId: null,
        };
        updated = [...updated, newGroup];
      } else {
        updated = updated.map(ch => {
          const chatId = ch.id?.toString() || `chat_${ch.dbId}`;
          if (chatId === `chat_${data.chatId}` || ch.dbId === data.chatId) {
            const exists = ch.members?.some(m => m.userId === data.member?.userId);
            if (exists) return ch;
            return {
              ...ch,
              name: data.chatName || ch.name,
              avatar: data.chatAvatar || ch.avatar,
              members: [...(ch.members || []), data.member]
            };
          }
          return ch;
        });
      }
      setGroupChatsVersion(prev => prev + 1);
      return updated;
    });
    if (activeChatId === `chat_${data.chatId}`) {
      setActiveChatData(prev => {
        const exists = prev?.members?.some(m => m.userId === data.member?.userId);
        if (exists) return prev;
        return {
          ...prev,
          name: data.chatName || prev?.name,
          avatar: data.chatAvatar || prev?.avatar,
          members: [...(prev?.members || []), data.member]
        };
      });
    }
    if (data.member?.userId === user?.id) {
      joinChat(`chat_${data.chatId}`);
      loadHistory(`chat_${data.chatId}`);
    }
  }, [setGroupChats, user, joinChat, activeChatId, setActiveChatData, loadHistory]);

  const handleChatMemberRemoved = useCallback((data) => {
    console.log('🔥🔥🔥 Событие chat_member_removed пришло!', data);
    setGroupChats(prev => {
      const updated = prev.map(ch => {
        const chatId = ch.id?.toString() || `chat_${ch.dbId}`;
        if (chatId === `chat_${data.chatId}` || ch.dbId === data.chatId) {
          return {
            ...ch,
            members: ch.members?.filter(m => m.userId !== data.userId) || []
          };
        }
        return ch;
      });
      setGroupChatsVersion(prev => prev + 1);
      return [...updated];
    });
    if (data.userId === user?.id) {
      removeGroupChat(data.chatId);
      if (activeChatIdRef.current === `chat_${data.chatId}`) {
        setActiveChatId('chat_general');
        setActiveChatData({ name: 'Общий чат', avatar: '💬', type: 'general' });
      }
    }
  }, [setGroupChats, user, removeGroupChat, setActiveChatId, setActiveChatData]);

  const handleSendMessage = useCallback((text, mediaUrl = null, mediaType = null) => {
    console.log('📤 handleSendMessage: activeChatId =', activeChatId, 'text =', text);
    if (!text && !mediaUrl) return;
    const messageData = { text, mediaUrl, mediaType, activeChatId };
    sendMessage(messageData);
  }, [sendMessage, activeChatId]);

  const handleDeleteMessage = useCallback((msgId) => {
    deleteMessageLocally(activeChatId, msgId);
    emit('delete_message', { messageId: msgId, activeChatId });
  }, [activeChatId, deleteMessageLocally, emit]);

  const handleLogout = useCallback(() => {
    if (socket) socket.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setActiveChatId(null);
  }, [socket]);

  const handleAuthSuccess = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  // === Подписки на сокеты ===
  useEffect(() => {
    if (!socket) return;
    socket.on('channel_created', handleChannelCreated);
    socket.on('channel_deleted', handleChannelDeleted);
    socket.on('chat_created', handleChatCreated);
    socket.on('chat_deleted', handleChatDeleted);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('thread_created', handleThreadCreated);
    socket.on('unread_updated', handleUnreadUpdated);
    socket.on('message_edited', handleMessageEdited);
    socket.on('channel_member_added', handleChannelMemberAdded);
    socket.on('channel_member_removed', handleChannelMemberRemoved);
    socket.on('chat_member_added', handleChatMemberAdded);
    socket.on('chat_member_removed', handleChatMemberRemoved);
    socket.on('user_updated', handleUserUpdated);
    socket.on('messages_read_update', handleMessagesReadUpdate);
    socket.on('message_pinned', handleMessagePinned);
    socket.on('kicked_from_channel', handleKickedFromChannel);
    socket.on('channel_updated', (data) => {
      setChannels(prev => prev.map(ch =>
        ch.id === data.id ? data : ch
      ));
      if (activeChatId === `channel_${data.id}`) {
        setActiveChatData(prev => ({ ...prev, name: data.name, avatar: data.avatar }));
      }
    });
    socket.on('chat_updated', (data) => {
      setGroupChats(prev => prev.map(ch =>
        ch.dbId === data.id ? { ...ch, name: data.name, avatar: data.avatar } : ch
      ));
      if (activeChatId === `chat_${data.id}`) {
        setActiveChatData(prev => ({ ...prev, name: data.name, avatar: data.avatar }));
      }
    });

    return () => {
      socket.off('channel_created', handleChannelCreated);
      socket.off('channel_deleted', handleChannelDeleted);
      socket.off('chat_created', handleChatCreated);
      socket.off('chat_deleted', handleChatDeleted);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('thread_created', handleThreadCreated);
      socket.off('unread_updated', handleUnreadUpdated);
      socket.off('message_edited', handleMessageEdited);
      socket.off('channel_member_added', handleChannelMemberAdded);
      socket.off('channel_member_removed', handleChannelMemberRemoved);
      socket.off('chat_member_added', handleChatMemberAdded);
      socket.off('chat_member_removed', handleChatMemberRemoved);
      socket.off('user_updated', handleUserUpdated);
      socket.off('messages_read_update', handleMessagesReadUpdate);
      socket.off('message_pinned', handleMessagePinned);
      socket.off('kicked_from_channel', handleKickedFromChannel);
      socket.off('channel_updated');
      socket.off('chat_updated');
    };
  }, [socket, handleChannelCreated, handleChannelDeleted, handleChatCreated, handleChatDeleted, handleReceiveMessage, handleMessageDeleted, handleReactionUpdated, handleThreadCreated, handleUnreadUpdated, handleMessageEdited, handleChannelMemberAdded, handleChannelMemberRemoved, handleChatMemberAdded, handleChatMemberRemoved, handleUserUpdated, handleMessagesReadUpdate, handleMessagePinned, handleKickedFromChannel]);

  // === Переключение чата ===
  const handleSelectChat = useCallback(async (chatId, chatData = null) => {
    if (!chatId) return;
    let normalizedChatId = chatId;
    while (normalizedChatId.startsWith('chat_chat_') ||
           normalizedChatId.startsWith('channel_channel_') ||
           normalizedChatId.startsWith('user_user_')) {
      if (normalizedChatId.startsWith('chat_chat_')) {
        normalizedChatId = normalizedChatId.replace('chat_chat_', 'chat_');
      } else if (normalizedChatId.startsWith('channel_channel_')) {
        normalizedChatId = normalizedChatId.replace('channel_channel_', 'channel_');
      } else if (normalizedChatId.startsWith('user_user_')) {
        normalizedChatId = normalizedChatId.replace('user_user_', 'user_');
      }
    }
    if (normalizedChatId === activeChatId) return;
    setActiveChatId(normalizedChatId);
    activeChatIdRef.current = normalizedChatId;
    joinChat(normalizedChatId);
    console.log('🔄 Сброс непрочитанных для чата:', normalizedChatId);
    resetUnread(normalizedChatId);
    await loadHistory(normalizedChatId);
    let activeData = chatData;
    if (!activeData) {
      if (normalizedChatId.startsWith('channel_')) {
        const ch = channels.find(c => `channel_${c.id}` === normalizedChatId);
        if (ch) activeData = { name: ch.name, avatar: ch.avatar, type: 'channel', creatorId: ch.creatorId, members: ch.members || [] };
      } else if (normalizedChatId.startsWith('chat_')) {
        const gr = groupChats.find(c => c.id === normalizedChatId || `chat_${c.dbId}` === normalizedChatId);
        if (gr) activeData = { name: gr.name, avatar: gr.avatar, type: 'group', creatorId: gr.creatorId, members: gr.members || [] };
      } else if (normalizedChatId.startsWith('user_')) {
        const pr = chats.find(c => c.id === normalizedChatId);
        if (pr) activeData = { name: pr.name, avatar: pr.avatar, type: 'private', dbId: pr.dbId };
      }
    }
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
        const errorMessage = err.message || 'Не удалось создать канал';
        showToast(errorMessage, 'error');
        throw err; // ← Чтобы ошибка дошла до модалки
    }
}, [addChannel, joinChat, handleSelectChat, user, showToast]);

const handleCreateGroupChat = useCallback(async (chatData) => {
    try {
        const newChat = await apiClient('/api/chats', {
            method: 'POST',
            body: JSON.stringify(chatData),
        });

        const numericId = parseInt(String(newChat.id).replace('chat_', ''), 10);
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
        const errorMessage = err.message || 'Не удалось создать групповой чат';
        showToast(errorMessage, 'error');
        throw err; // ← Чтобы ошибка дошла до модалки
    }
}, [addGroupChat, joinChat, handleSelectChat, user, showToast]);

  const handleChatUpdate = useCallback((updated) => {
    if (updated.type === 'channel') {
      setChannels(prev => prev.map(ch =>
        ch.id === updated.id ? updated : ch
      ));
      if (activeChatId === `channel_${updated.id}`) {
        setActiveChatData(prev => ({ ...prev, name: updated.name, avatar: updated.avatar }));
      }
    } else if (updated.type === 'group') {
      setGroupChats(prev => prev.map(ch =>
        ch.dbId === updated.id ? { ...ch, name: updated.name, avatar: updated.avatar } : ch
      ));
      setGroupChatsVersion(prev => prev + 1);
      if (activeChatId === `chat_${updated.id}`) {
        setActiveChatData(prev => ({ ...prev, name: updated.name, avatar: updated.avatar }));
      }
    }
  }, [setChannels, setGroupChats, activeChatId, setActiveChatData]);

  // === Рендер ===
  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} apiBaseUrl={API_BASE_URL} />;
  }

  const activeMessages = getMessages(activeChatId);
  console.log('🔁 activeMessages обновлён:', activeMessages.length);

  return (
    <ErrorBoundary>
      <div className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white h-screen flex justify-center items-center font-sans antialiased transition-colors duration-300">
        <div className="w-full h-full md:max-w-5xl md:h-[90vh] md:rounded-2xl md:border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex overflow-hidden shadow-2xl transition-colors duration-300">
<Sidebar
    loading={chatsLoading}
    chats={chats}
    channels={channels}
    showToast={showToast}
    groupChats={groupChats}
    activeChatId={activeChatId}
    unreadCounts={unreadCounts}
    onSelectChat={handleSelectChat}
    onCreateChannel={handleCreateChannel}
    onCreateGroupChat={handleCreateGroupChat}
    chatsVersion={chatsVersion}
    channelsVersion={channelsVersion}
    groupChatsVersion={groupChatsVersion}
    searchQuery={searchQuery}          // ← заменили
    setSearchQuery={setSearchQuery}    // ← заменили
    isDarkMode={isDarkMode}
    onToggleTheme={toggleTheme}
    onLogout={handleLogout}
    user={user}
    onUpdateUser={(u) => { localStorage.setItem('user', JSON.stringify(u)); setUser(u); }}
    formatMsgTime={(d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
/>
          <MessageContext.Provider value={{ sendMessage: handleSendMessage }}>
            <ChatArea
              key={activeChatId || 'no-chat'}
              activeChatId={activeChatId}
              activeChatData={activeChatData}
              messages={activeMessages}
              currentUserId={user?.id}
              socketRef={socket}
              isSocketConnected={isSocketConnected}
              setMessages={setMessagesByChat}
              setActiveChatId={setActiveChatId}
              onDeleteMessage={handleDeleteMessage}
              onSelectChat={handleSelectChat}
              chatsProp={chats}
              showToast={showToast} 
              groupChatsProp={groupChats}
              channelsProp={channels}
              onLoadMoreHistory={() => {
                const oldest = activeMessages.length > 0 ? activeMessages[0]?.id : null;
                loadHistory(activeChatId, oldest);
              }}
              hasMoreHistory={hasMore(activeChatId)}
              isHistoryLoading={loading(activeChatId)}
              onToggleProfile={() => setIsProfileOpen(!isProfileOpen)}
              onMarkAsRead={debouncedMarkAsRead}
              onPinMessage={handlePin}
            />
          </MessageContext.Provider>
          <ProfilePanel
            activeChat={{ ...activeChatData, id: activeChatId, messages: activeMessages }}
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            socketRef={socket}
            showToast={showToast} 
            onMemberRemoved={() => {}}
            onChatDeleted={() => {}}
            onChatUpdate={handleChatUpdate}
            onMemberAdded={(newMember) => {
              setActiveChatData(prev => ({ ...prev, members: [...(prev?.members || []), newMember] }));
            }}
            onChatUpdate={(updated) => {
              if (updated.type === 'channel') {
                setChannels(prev => prev.map(ch => ch.id === updated.id ? updated : ch));
                if (activeChatId === `channel_${updated.id}`) {
                  setActiveChatData(prev => ({ ...prev, name: updated.name, avatar: updated.avatar }));
                }
              } else if (updated.type === 'group') {
                setGroupChats(prev => prev.map(ch => ch.dbId === updated.id ? { ...ch, name: updated.name, avatar: updated.avatar } : ch));
                if (activeChatId === `chat_${updated.id}`) {
                  setActiveChatData(prev => ({ ...prev, name: updated.name, avatar: updated.avatar }));
                }
              }
            }}
          />
          {toast && (
  <Toast
    message={toast.message}
    type={toast.type}
    duration={toast.duration}
    onClose={hideToast}
  />
)}
        </div>
      </div>
    </ErrorBoundary>
  );
}