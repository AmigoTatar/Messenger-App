import React, { useState } from 'react';
import UserProfile from './UserProfile';
import PrivateChatList from './PrivateChatList';
import ChannelList from './ChannelList';
import GroupList from './GroupList';
import CreateChannelModal from './CreateChannelModal';
import CreateGroupModal from './CreateGroupModal';
import SearchModal from '../SearchModal';

export default function Sidebar({
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
  chatsVersion,
}) {
  // ✅ Добавь этот лог для проверки
  console.log('🔍 Sidebar: onSelectChat =', onSelectChat);

  const [isNewChannelOpen, setIsNewChannelOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <div className="w-full md:w-80 h-full max-h-screen overflow-hidden border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 transition-colors duration-300">
      
      {/* Верхняя часть с профилем и кнопками */}
      <div className="p-4 space-y-3">
        <UserProfile user={user} onUpdateUser={onUpdateUser} />

        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-zinc-800 dark:text-white">Чаты</h1>
          <div className="flex gap-2">
            <button onClick={() => setIsNewChannelOpen(true)} className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition shadow-md">📢+</button>
            <button onClick={() => setIsNewGroupOpen(true)} className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition shadow-md">👥+</button>
          </div>
        </div>

        <div className="relative">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск..." className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500 transition text-zinc-800 dark:text-white placeholder-zinc-400" />
          <span className="absolute left-3 top-2.5 text-xs text-zinc-400">🔍</span>
        </div>
      </div>

      {/* Списки чатов */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-2 space-y-1">
        <PrivateChatList
          chats={chats}
          activeChatId={activeChatId}
          unreadCounts={unreadCounts}
          onSelectChat={onSelectChat}
          formatMsgTime={formatMsgTime}
          chatsVersion={chatsVersion}
        />
        <ChannelList
          channels={channels}
          channelsVersion={channelsVersion}
          activeChatId={activeChatId}
          unreadCounts={unreadCounts}
          onSelectChat={onSelectChat}
          formatMsgTime={formatMsgTime}
        />
        <GroupList
          groupChats={groupChats}
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
          <span className="text-[11px] text-zinc-400 font-medium">Mini Messenger v3.1</span>
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
      />
      <CreateGroupModal
        isOpen={isNewGroupOpen}
        onClose={() => setIsNewGroupOpen(false)}
        onCreate={onCreateGroupChat}
      />
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onMessageClick={(chatId, messageId) => {
          if (typeof onSelectChat === 'function') onSelectChat(chatId);
        }}
      />
    </div>
  );
}