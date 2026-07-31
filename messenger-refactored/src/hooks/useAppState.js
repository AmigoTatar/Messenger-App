import { useState, useRef } from 'react';

export function useAppState() {
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
  const [contactsVersion, setContactsVersion] = useState(0);

  // === Рефы ===
  const processedEvents = useRef(new Set());
  const activeChatIdRef = useRef(activeChatId);
  const pinnedProcessingRef = useRef(new Set());

  return {
    // Состояния
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
    // Рефы
    processedEvents,
    activeChatIdRef,
    pinnedProcessingRef,
  };
}