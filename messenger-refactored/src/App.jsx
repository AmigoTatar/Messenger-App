import React, { useCallback, useMemo, useEffect, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar/Sidebar';
import ChatArea from './components/ChatArea/ChatArea';
import ProfilePanel from './components/ProfilePanel/ProfilePanel';
import Auth from './Auth';
import { useAppState } from './hooks/useAppState';
import { useMessageHandlers } from './hooks/useMessageHandlers';
import { useSocket } from './hooks/useSocket';
import { useMessages } from './hooks/useMessages';
import { useChats } from './hooks/useChats';
import { useUnread } from './hooks/useUnread';
import { useMarkAsRead } from './hooks/useMarkAsRead';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { useContacts } from './hooks/useContacts';
import { getChatIdFromMessage } from './utils/chatUtils';
import { playNotificationSound } from './utils/soundUtils';
import { API_BASE_URL } from './config';
import { apiClient } from './services/apiClient';
import { MessageContext } from './contexts/MessageContext';
import Toast from '/src/Toast';
import { useAppHandlers } from './hooks/useAppHandlers';
import { extractNumericId } from './utils/chatUtils';
import ConfirmModal from './components/ConfirmModal';
import { registerPush } from './services/pushRegistration';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';


export default function App() {
  // ====== ВСЕ СОСТОЯНИЯ ИЗ ХУКА ======
  const {
    user,
    setUser,
    activeChatId,
    setActiveChatId,
    activeChatData,
    setActiveChatData,
    isProfileOpen,
    setIsProfileOpen,
    groupChatsVersion,
    setGroupChatsVersion,
    chatsVersion,
    setChatsVersion,
    channelsVersion,
    setChannelsVersion,
    isSocketConnected,
    setIsSocketConnected,
    isNewChannelOpen,
    setIsNewChannelOpen,
    isNewGroupOpen,
    setIsNewGroupOpen,
    searchQuery,
    setSearchQuery,
    contactsVersion,
    setContactsVersion,
    processedEvents,
    activeChatIdRef,
    pinnedProcessingRef,
  } = useAppState();

  // ====== ХУКИ ======
  const { isDarkMode, toggleTheme } = useTheme();
  const { chats, channels, groupChats, addChannel, addGroupChat, removeChannel, removeGroupChat, setChannels, setGroupChats, setChats, reload: reloadChats, loading: chatsLoading, clearChats } = useChats(user);
  const { contacts, loading: contactsLoading, addContact, removeContact, searchUsers, setContacts, fetchContacts, clearContacts } = useContacts(user);
  const { unreadCounts, fetchUnread, updateUnread, resetUnread, clearUnread } = useUnread(user);
  const { getMessages, addMessage, addMessages, loadHistory, hasMore, loading, markMessageAsRead, deleteMessageLocally, setMessagesByChat, clearMessages } = useMessages(user?.id);
  const { markAsRead, debouncedMarkAsRead } = useMarkAsRead();
  const { socket, emit, joinChat, sendMessage, isConnected } = useSocket(user, {});
  const { toast, showToast, hideToast } = useToast();

  const resetSessionState = useCallback(() => {
    clearMessages();
    clearChats();
    clearContacts();
    clearUnread();
    setActiveChatId(null);
    setActiveChatData(null);
    setIsProfileOpen(false);
    activeChatIdRef.current = null;
    processedEvents.current.clear();
  }, [clearMessages, clearChats, clearContacts, clearUnread, setActiveChatId, setActiveChatData, setIsProfileOpen, activeChatIdRef, processedEvents]);

  useEffect(() => {
    setIsSocketConnected(!!isConnected);
  }, [isConnected, setIsSocketConnected]);


  
  // ====== ОБРАБОТЧИКИ ИЗ ХУКА ======
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
  processedEvents,
  setContacts,
  setContactsVersion,
  fetchContacts,
  // Новые
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
  activeChatId,
  pinnedProcessingRef,
});

  const {
  // Старые
  handleReactionUpdated,
  handleThreadCreated,
  handleMessageEdited,
  handleMessageDeleted,
  handleUserUpdated,
  handleKickedFromChannel,
  handleMessagePinned,
  handleUnreadUpdated,
  handleMessagesReadUpdate,
  // Новые
  handleSelectChat,
  handleSendMessage,
  handleDeleteMessage,
  handleReceiveMessage,
  handlePin,
  handleCreateChannel,
  handleCreateGroupChat,
  handleChatUpdate,
  handleLogout: rawHandleLogout,
} = messageHandlers;

  const handleLogout = useCallback(() => {
    resetSessionState();
    rawHandleLogout();
  }, [resetSessionState, rawHandleLogout]);

  

 // ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======
const handleAuthSuccess = (userData, token) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(userData));
  setUser(userData);
  // JWT уже в localStorage — регистрируем пуш сразу после логина
  registerPush().catch((err) => {
    console.error('❌ [PUSH] Ошибка после логина:', err);
  });
};


  const handleUpdateUser = useCallback((u) => {
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
  }, [setUser]);

  // ====== МОДАЛКА ПОДТВЕРЖДЕНИЯ ======
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    variant: 'danger'
  });

  const showConfirm = useCallback((title, message, confirmText, onConfirm, variant = 'danger') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      variant
    });
  }, []);

  // ====== НАВИГАЦИЯ НАЗАД (веб-стрелка / Escape / Android back) ======
  const closeActiveChat = useCallback(() => {
    setIsProfileOpen(false);
    setActiveChatId(null);
    setActiveChatData(null);
    activeChatIdRef.current = null;
  }, [setIsProfileOpen, setActiveChatId, setActiveChatData, activeChatIdRef]);

  /** @returns {boolean} true если что-то закрыли */
  const handleNavigateBack = useCallback(() => {
    if (confirmModal.isOpen) {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      return true;
    }
    if (isProfileOpen) {
      setIsProfileOpen(false);
      return true;
    }
    if (activeChatId) {
      closeActiveChat();
      return true;
    }
    return false;
  }, [confirmModal.isOpen, isProfileOpen, activeChatId, closeActiveChat]);

  // Держим ref в синхронизации со state (unread / kick handlers)
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId, activeChatIdRef]);

  // Browser Back: закрываем профиль/чат, если открыты
  useEffect(() => {
    if (activeChatId && window.history.state?.potokChat !== activeChatId) {
      window.history.pushState({ potokChat: activeChatId }, '');
    }
  }, [activeChatId]);

  useEffect(() => {
    const onPopState = () => {
      if (isProfileOpen) {
        setIsProfileOpen(false);
        if (activeChatId) {
          window.history.pushState({ potokChat: activeChatId }, '');
        }
        return;
      }
      if (activeChatId) {
        setActiveChatId(null);
        setActiveChatData(null);
        activeChatIdRef.current = null;
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [activeChatId, isProfileOpen, setActiveChatId, setActiveChatData, activeChatIdRef]);

  // Android system Back через @capacitor/app
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let cancelled = false;
    let handle = null;

    CapApp.addListener('backButton', () => {
      const handled = handleNavigateBack();
      if (!handled) {
        CapApp.exitApp();
      }
    }).then((h) => {
      if (cancelled) {
        h.remove();
        return;
      }
      handle = h;
    });

    return () => {
      cancelled = true;
      if (handle) handle.remove();
    };
  }, [handleNavigateBack]);


  const handleChannelCreated = useCallback(async (newChannel) => {
    const numericId = extractNumericId(newChannel.id);
    if (numericId === null) return;
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
    const numericId = extractNumericId(newChat.id);
    if (numericId === null) return;
    const idWithPrefix = `chat_${numericId}`;
    const normalized = { ...newChat, id: idWithPrefix, dbId: numericId };
    addGroupChat(normalized);
    joinChat(idWithPrefix);
  }, [addGroupChat, joinChat]);

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
      setActiveChatData(prev => ({ ...prev, members: [...(prev?.members || []), data.member] }));
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
    if (data.chatData) {
      setGroupChats(prev => {
        const exists = prev.some(ch => ch.dbId === data.chatData.id || ch.id === `chat_${data.chatData.id}`);
        if (exists) {
          return prev.map(ch => {
            if (ch.dbId === data.chatData.id || ch.id === `chat_${data.chatData.id}`) {
              return { ...ch, name: data.chatData.name, avatar: data.chatData.avatar, members: data.chatData.members || [], lastMessage: data.chatData.lastMessage || null, creatorId: data.chatData.creatorId };
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
        setActiveChatData(prev => ({ ...prev, name: data.chatData.name, avatar: data.chatData.avatar, members: data.chatData.members || [] }));
      }
      setGroupChatsVersion(prev => prev + 1);
      return;
    }
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
            return { ...ch, name: data.chatName || ch.name, avatar: data.chatAvatar || ch.avatar, members: [...(ch.members || []), data.member] };
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
        return { ...prev, name: data.chatName || prev?.name, avatar: data.chatAvatar || prev?.avatar, members: [...(prev?.members || []), data.member] };
      });
    }
    if (data.member?.userId === user?.id) {
      joinChat(`chat_${data.chatId}`);
      loadHistory(`chat_${data.chatId}`);
    }
  }, [setGroupChats, user, joinChat, activeChatId, setActiveChatData, loadHistory]);

  const handleChatMemberRemoved = useCallback((data) => {
    setGroupChats(prev => {
      const updated = prev.map(ch => {
        const chatId = ch.id?.toString() || `chat_${ch.dbId}`;
        if (chatId === `chat_${data.chatId}` || ch.dbId === data.chatId) {
          return { ...ch, members: ch.members?.filter(m => m.userId !== data.userId) || [] };
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

  
 
  // ====== РЕНДЕР ======
  const activeMessages = useMemo(() => {
    const msgs = getMessages(activeChatId);
    console.log(' activeMessages обновлён:', msgs.length);
    return msgs;
  }, [activeChatId, getMessages]);

  // Стабильный объект для ProfilePanel — без refetch на каждое новое сообщение
  const profileActiveChat = useMemo(() => {
    if (!activeChatId) return null;
    return {
      ...activeChatData,
      id: activeChatId,
      messages: activeMessages,
    };
  }, [
    activeChatId,
    activeChatData?.name,
    activeChatData?.avatar,
    activeChatData?.type,
    activeChatData?.creatorId,
    activeChatData?.members,
    activeMessages,
  ]);



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
    const userId = parseInt(activeChatId.replace('user_', ''), 10);
    const fromChats = chats.find(c => c.id === activeChatId || c.dbId === userId);
    const fromContacts = contacts.find(c => c.id === userId);
    if (fromChats) {
      setActiveChatData({ name: fromChats.name, avatar: fromChats.avatar, type: 'private', dbId: fromChats.dbId || userId });
      found = true;
    } else if (fromContacts) {
      setActiveChatData({
        name: fromContacts.username || fromContacts.name,
        avatar: fromContacts.avatar,
        type: 'private',
        dbId: fromContacts.id,
      });
      found = true;
    }
  }
  if (!found && activeChatId !== 'chat_general') {
    console.log(' Чат не найден, сбрасываю activeChatId');
    setActiveChatId(null);
    setActiveChatData(null);
  }
}, [activeChatId, channels, groupChats, chats, contacts]);

useEffect(() => {
  if (!socket || !isConnected) return;
  // Только реальные комнаты пользователя — НЕ весь каталог /api/users
  groupChats.forEach(chat => {
    const chatId = chat.id || `chat_${chat.dbId}`;
    if (chatId) joinChat(chatId);
  });
  channels.forEach(channel => {
    joinChat(`channel_${channel.id}`);
  });
  contacts.forEach(contact => {
    if (contact?.id) joinChat(`user_${contact.id}`);
  });
}, [socket, isConnected, groupChats, channels, contacts, joinChat]);

useEffect(() => {
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      handleNavigateBack();
    }
  };
  window.addEventListener('keydown', handleEsc);
  return () => window.removeEventListener('keydown', handleEsc);
}, [handleNavigateBack]);

useEffect(() => {
  if (!user) return;
  if (!localStorage.getItem('token')) return;

  registerPush().catch((err) => {
    console.error('❌ [PUSH] Ошибка при session restore:', err);
  });
}, [user?.id]);

  const onContactAdded = useCallback((userData) => {
    showToast('📱 Вас добавили в контакты');
    setContacts((prev) => {
      if (prev.some((c) => c.id === userData.id)) return prev;
      return [...prev, userData];
    });
    setContactsVersion((v) => v + 1);
  }, [showToast, setContacts, setContactsVersion]);

  const onChannelUpdated = useCallback((data) => {
    setChannels((prev) => prev.map((ch) => (ch.id === data.id ? data : ch)));
    setChannelsVersion((v) => v + 1);
    if (activeChatIdRef.current === `channel_${data.id}`) {
      setActiveChatData((prev) => ({ ...prev, name: data.name, avatar: data.avatar }));
    }
  }, [setChannels, setChannelsVersion, activeChatIdRef, setActiveChatData]);

  const onChatUpdated = useCallback((data) => {
    setGroupChats((prev) =>
      prev.map((ch) => (ch.dbId === data.id ? { ...ch, name: data.name, avatar: data.avatar } : ch))
    );
    setGroupChatsVersion((v) => v + 1);
    if (activeChatIdRef.current === `chat_${data.id}`) {
      setActiveChatData((prev) => ({ ...prev, name: data.name, avatar: data.avatar }));
    }
  }, [setGroupChats, setGroupChatsVersion, activeChatIdRef, setActiveChatData]);

  const onJoinRequestApproved = useCallback((data) => {
    showToast(`🎉 Вас приняли в канал "${data.channelName}"!`, 'success');
    reloadChats({ silent: true });
  }, [showToast, reloadChats]);

  const onJoinRequestRejected = useCallback((data) => {
    showToast(`😔 Ваша заявка в канал "${data.channelName}" отклонена`, 'info');
  }, [showToast]);

  const onJoinRequestReceived = useCallback((data) => {
    showToast(`📩 Новая заявка в канал "${data.channelName}"`, 'info');
  }, [showToast]);

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
  socket.on('contact_added', onContactAdded);
  socket.on('channel_updated', onChannelUpdated);
  socket.on('chat_updated', onChatUpdated);
  socket.on('join_request_approved', onJoinRequestApproved);
  socket.on('join_request_rejected', onJoinRequestRejected);
  socket.on('join_request_received', onJoinRequestReceived);

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
    socket.off('contact_added', onContactAdded);
    socket.off('channel_updated', onChannelUpdated);
    socket.off('chat_updated', onChatUpdated);
    socket.off('join_request_approved', onJoinRequestApproved);
    socket.off('join_request_rejected', onJoinRequestRejected);
    socket.off('join_request_received', onJoinRequestReceived);
  };
}, [
  socket,
  handleChannelCreated,
  handleChannelDeleted,
  handleChatCreated,
  handleChatDeleted,
  handleReceiveMessage,
  handleMessageDeleted,
  handleReactionUpdated,
  handleThreadCreated,
  handleUnreadUpdated,
  handleMessageEdited,
  handleChannelMemberAdded,
  handleChannelMemberRemoved,
  handleChatMemberAdded,
  handleChatMemberRemoved,
  handleUserUpdated,
  handleMessagesReadUpdate,
  handleMessagePinned,
  handleKickedFromChannel,
  onContactAdded,
  onChannelUpdated,
  onChatUpdated,
  onJoinRequestApproved,
  onJoinRequestRejected,
  onJoinRequestReceived,
]);

 if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} apiBaseUrl={API_BASE_URL} />;
  }
  return (
    <ErrorBoundary>
      <div className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white h-screen flex justify-center items-center font-sans antialiased transition-colors duration-300">
        
<div className="w-full h-full md:max-w-5xl md:h-[90vh] md:rounded-2xl md:border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex overflow-hidden shadow-2xl transition-colors duration-300">

  {/* Сайдбар — скрыт на мобилках когда чат открыт */}
  <div className={`${activeChatId ? 'hidden' : 'flex'} md:flex w-full md:w-[380px] flex-shrink-0 flex-col`}>
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
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      isDarkMode={isDarkMode}
      onToggleTheme={toggleTheme}
      onLogout={handleLogout}
      user={user}
      onUpdateUser={handleUpdateUser}
      formatMsgTime={(d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
      contacts={contacts}
      contactsLoading={contactsLoading}
      onAddContact={async (id) => {
        const result = await addContact(id);
        setContactsVersion((v) => v + 1);
        return result;
      }}
      onRemoveContact={async (id) => {
        await removeContact(id);
        setContactsVersion((v) => v + 1);
      }}
      onSearchUsers={searchUsers}
      contactsVersion={contactsVersion}
    />
  </div>

  {/* Чат — скрыт на мобилках когда чат не выбран */}
  <div className={`${!activeChatId ? 'hidden' : 'flex'} md:flex flex-1 flex-col`}>
    <MessageContext.Provider value={{ sendMessage: handleSendMessage }}>
      {console.log('📤 [App] contacts перед передачей в ChatArea:', contacts)}
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
        onBack={handleNavigateBack}
        onDeleteMessage={handleDeleteMessage}
        onSelectChat={handleSelectChat}
        chatsProp={chats}
        contacts={contacts}
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
        showConfirm={showConfirm}
      />
    </MessageContext.Provider>
  </div>

  {/* Профиль */}
  <ProfilePanel
    activeChat={profileActiveChat}
    isOpen={isProfileOpen}
    onClose={() => setIsProfileOpen(false)}
    socketRef={socket}
    showToast={showToast}
    onMemberRemoved={() => {}}
    onChatDeleted={() => {}}
    onChatUpdate={handleChatUpdate}
    contacts={contacts}
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

  {/* Тосты */}
  {toast && (
    <Toast
      message={toast.message}
      type={toast.type}
      duration={toast.duration}
      onClose={hideToast}
    />
  )}

  {/* Модалка подтверждения */}
  <ConfirmModal
    isOpen={confirmModal.isOpen}
    onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
    onConfirm={confirmModal.onConfirm}
    title={confirmModal.title}
    message={confirmModal.message}
    confirmText={confirmModal.confirmText}
    confirmVariant={confirmModal.variant}
  />
</div>


      </div>
    </ErrorBoundary>
  );
}