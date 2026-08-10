import React, { useState } from 'react';
import UserProfile from './UserProfile';
import ChannelList from './ChannelList';
import GroupList from './GroupList';
import CreateChannelModal from './CreateChannelModal';
import CreateGroupModal from './CreateGroupModal';
import SearchModal from '../SearchModal';
import LoadingSpinner from '../LoadingSpinner';
import ContactList from './ContactList';
import AddContactModal from './AddContactModal';
import ChannelSearchModal from './ChannelSearchModal';

export default function Sidebar({
  loading,
  chats,
  channels,
  groupChats,
  activeChatId,
  unreadCounts,
  onSelectChat,
  onCreateChannel,
  onCreateGroupChat,
  searchQuery,
  setSearchQuery,
  isDarkMode,
  onToggleTheme,
  onLogout,
  user,
  onUpdateUser,
  formatMsgTime,
  channelsVersion,
  groupChatsVersion,
  showToast,
  chatsVersion,
  contacts,
  contactsLoading,
  onAddContact,
  onRemoveContact,
  onSearchUsers,
  contactsVersion,
}) {
  
  console.log('🔍 Sidebar: onSelectChat =', onSelectChat);

  const [isNewChannelOpen, setIsNewChannelOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isChannelSearchOpen, setIsChannelSearchOpen] = useState(false);
  if (loading) {
  return (
    <div className="w-full md:w-80 h-full flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

const filteredContacts = contacts.filter(c => 
    c.username?.toLowerCase().includes(searchQuery.toLowerCase())
);
const filteredChannels = channels.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
);
const filteredGroups = groupChats.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
);

/*console.log(' Sidebar: filteredContacts:', JSON.stringify(filteredContacts.map(c => ({ 
    id: c.id, 
    name: c.username, 
    lastMessage: c.lastMessage 
})), null, 2));*/
  return (
   
    <div className="w-full max-w-full overflow-hidden border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 transition-colors duration-300">
      
      {/* Верхняя часть с профилем и кнопками */}
      <div className="p-4 space-y-3">
        <UserProfile user={user} onUpdateUser={onUpdateUser} />

        <div className="flex justify-between items-center">
    <h1 className="text-xl font-bold text-zinc-800 dark:text-white">Чаты</h1>

<div className="flex gap-2">
    <button 
        onClick={() => setIsAddContactOpen(true)} 
        className="p-2.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
        title="Добавить контакт"
    >
        ➕
    </button>
    <button 
        onClick={() => setIsChannelSearchOpen(true)} 
        className="p-2.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-300 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
        title="Поиск каналов"
    >
        🔍
    </button>
    <button 
        onClick={() => setIsNewChannelOpen(true)} 
        className="p-2.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
        title="Создать канал"
    >
        📢+
    </button>
    <button 
        onClick={() => setIsNewGroupOpen(true)} 
        className="p-2.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
        title="Создать групповой чат"
    >
        👥+
    </button>
</div>


</div>

        <div className="relative">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск..." className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500 transition text-zinc-800 dark:text-white placeholder-zinc-400" />
          <span className="absolute left-3 top-2.5 text-xs text-zinc-400">🔍</span>
        </div>
      </div>

      {/* Списки чатов */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-2 space-y-1">
        
        <ContactList
        
    contacts={filteredContacts}
    contactsVersion={contactsVersion}
    activeChatId={activeChatId}
    unreadCounts={unreadCounts}
    onSelectChat={onSelectChat}
    formatMsgTime={formatMsgTime}
          />
        <ChannelList
          channels={filteredChannels}
          channelsVersion={channelsVersion}
          activeChatId={activeChatId}
          unreadCounts={unreadCounts}
          onSelectChat={onSelectChat}
          formatMsgTime={formatMsgTime}
        />
        <GroupList
          groupChats={filteredGroups}
          activeChatId={activeChatId}
          unreadCounts={unreadCounts}
          onSelectChat={onSelectChat}
          formatMsgTime={formatMsgTime}
          groupChatsVersion={groupChatsVersion}
        />
      </div>

      {/* Нижняя панель */}
      <div className="p-3 border-t border-zinc-100 dark:border-zinc-900 flex flex-col gap-2 bg-zinc-50/50 dark:bg-zinc-950/20 mt-auto">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-zinc-400 font-medium">Potok </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsSearchOpen(true)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition text-zinc-500 dark:text-zinc-400" title="Поиск (Ctrl+K)">🔍</button>
            <button onClick={onToggleTheme} className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-xl transition active:scale-95 shadow-sm">
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-100 hover:bg-red-50 dark:bg-zinc-900 dark:hover:bg-red-950/30 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition">
          🚪 Выйти
        </button>
      </div>

      {/* Модалки */}
      <CreateChannelModal
        isOpen={isNewChannelOpen}
        onClose={() => setIsNewChannelOpen(false)}
        onCreate={onCreateChannel}
        showToast={showToast}
      />
      <CreateGroupModal
        isOpen={isNewGroupOpen}
        onClose={() => setIsNewGroupOpen(false)}
        onCreate={onCreateGroupChat}
        showToast={showToast}
        contacts={contacts}
      />
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onMessageClick={(chatId, messageId) => {
          if (typeof onSelectChat === 'function') onSelectChat(chatId);
        }}
      />
      <AddContactModal
    isOpen={isAddContactOpen}
    onClose={() => setIsAddContactOpen(false)}
    onSearch={onSearchUsers}
    onAdd={onAddContact}
    existingContacts={contacts}
/>
<ChannelSearchModal
    isOpen={isChannelSearchOpen}
    onClose={() => setIsChannelSearchOpen(false)}
    onSelectChannel={onSelectChat}
    currentUserId={user?.id}
    showToast={showToast}
/>
    </div>

  );
}