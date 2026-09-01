import React, { useState, useEffect } from 'react';
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
import { apiClient } from '../../services/apiClient';
import { SUPPORT_EMAIL, LEGAL_PAGES, isNativeApp } from '../../config';
import { useNavigate } from 'react-router-dom';
import DownloadAppButton from '../DownloadAppButton';
import UpdateAppButton from '../UpdateAppButton';

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
  onUnhideContact,
  onSearchUsers,
  contactsVersion,
  onlineUserIds,
  showConfirm,
}) {
  const navigate = useNavigate();
  const [isNewChannelOpen, setIsNewChannelOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isChannelSearchOpen, setIsChannelSearchOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reports, setReports] = useState([]);
  const [legalPage, setLegalPage] = useState(null);
  const [sidebarTab, setSidebarTab] = useState(() => {
    try {
      const v = localStorage.getItem('potok-sidebar-tab');
      if (v === 'groups' || v === 'channels' || v === 'chats') return v;
    } catch {
      /* ignore */
    }
    return 'chats';
  });

  const switchTab = (tab) => {
    setSidebarTab(tab);
    try {
      localStorage.setItem('potok-sidebar-tab', tab);
    } catch {
      /* ignore */
    }
  };

  const openSupport = () => {
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Potok: обращение в поддержку')}`;
    window.location.href = mailto;
    showToast?.(`Напишите на ${SUPPORT_EMAIL}`, 'info');
  };

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    apiClient('/api/reports/status')
      .then((data) => {
        if (cancelled) return;
        setIsAdmin(!!data.admin);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    const onHwBack = (e) => {
      if (isNewChannelOpen) { e.preventDefault(); setIsNewChannelOpen(false); return; }
      if (isNewGroupOpen) { e.preventDefault(); setIsNewGroupOpen(false); return; }
      if (isSearchOpen) { e.preventDefault(); setIsSearchOpen(false); return; }
      if (isAddContactOpen) { e.preventDefault(); setIsAddContactOpen(false); return; }
      if (isChannelSearchOpen) { e.preventDefault(); setIsChannelSearchOpen(false); return; }
      if (reportsOpen) { e.preventDefault(); setReportsOpen(false); return; }
      if (legalPage) { e.preventDefault(); setLegalPage(null); return; }
    };
    window.addEventListener('potok-hardware-back', onHwBack);
    return () => window.removeEventListener('potok-hardware-back', onHwBack);
  }, [isNewChannelOpen, isNewGroupOpen, isSearchOpen, isAddContactOpen, isChannelSearchOpen, reportsOpen, legalPage]);

  if (loading && (!channels?.length && !groupChats?.length && !contacts?.length)) {
  return (
    <div className="w-full md:w-80 h-full flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

const byLastMessage = (a, b) => {
    const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return tb - ta;
};
const filteredContacts = contacts
    .filter(c => c.username?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort(byLastMessage);
const filteredChannels = channels
    .filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort(byLastMessage);
const filteredGroups = groupChats
    .filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort(byLastMessage);

  const chatsUnread = (contacts || []).some((c) => !c.hidden && (unreadCounts[`user_${c.id}`] || 0) > 0);
  const groupsUnread = (groupChats || []).some((g) => (unreadCounts[g.id || `chat_${g.dbId}`] || 0) > 0);
  const channelsUnread = (channels || []).some((c) => (unreadCounts[`channel_${c.id}`] || 0) > 0);

  const tabBtn = (id, icon, label, unread) => (
    <button
      type="button"
      onClick={() => switchTab(id)}
      className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-medium transition ${
        sidebarTab === id
          ? 'bg-emerald-600 text-white'
          : unread
            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-500/50'
            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
      {unread && sidebarTab !== id && (
        <span className="absolute top-1.5 right-1/4 w-1.5 h-1.5 rounded-full bg-emerald-500" />
      )}
    </button>
  );

  return (
   
    <div className="w-full h-full min-h-0 max-w-full overflow-hidden border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 transition-colors duration-300">
      
      {/* Верхняя часть с профилем и кнопками */}
      <div className="shrink-0 p-4 space-y-3">
        <UserProfile user={user} onUpdateUser={onUpdateUser} showToast={showToast} />

        <div className="flex justify-between items-center">
    <h1 className="text-xl font-bold text-zinc-800 dark:text-white">
      {sidebarTab === 'groups' ? 'Группы' : sidebarTab === 'channels' ? 'Каналы' : 'Чаты'}
    </h1>

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
          <input id="sidebar-search" name="search" type="text" autoComplete="off" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск..." className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500 transition text-zinc-800 dark:text-white placeholder-zinc-400" />
          <span className="absolute left-3 top-2.5 text-xs text-zinc-400">🔍</span>
        </div>
      </div>

      {/* Списки чатов */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-2 py-2 flex flex-col">
        {sidebarTab === 'chats' && (
          <>
            <button
              type="button"
              onClick={() => navigate('/ai')}
              className="w-full flex items-center p-3 rounded-xl transition-all select-none text-left cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
            >
              <div className="relative mr-3 shrink-0 w-11 h-11 rounded-full bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-xl">
                🤖
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-xs text-zinc-800 dark:text-zinc-100 truncate">Potok AI (скоро)</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">Ассистент в версии 1.2</p>
              </div>
            </button>
            {filteredContacts.length > 0 ? (
              <ContactList
                contacts={filteredContacts}
                contactsVersion={contactsVersion}
                activeChatId={activeChatId}
                unreadCounts={unreadCounts}
                onSelectChat={onSelectChat}
                onRemoveContact={onRemoveContact}
                onUnhideContact={onUnhideContact}
                showConfirm={showConfirm}
                formatMsgTime={formatMsgTime}
                onlineUserIds={onlineUserIds}
                currentUserId={user?.id}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center px-6 text-center text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
                Пока нет чатов. Добавьте контакт кнопкой ➕
              </div>
            )}
          </>
        )}
        {sidebarTab === 'channels' && (
          filteredChannels.length > 0 ? (
            <ChannelList
              channels={filteredChannels}
              channelsVersion={channelsVersion}
              activeChatId={activeChatId}
              unreadCounts={unreadCounts}
              onSelectChat={onSelectChat}
              formatMsgTime={formatMsgTime}
              currentUserId={user?.id}
              hideTitle
            />
          ) : (
            <div className="flex-1 flex items-center justify-center px-6 text-center text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
              Пока нет каналов. Найдите через 🔍 или создайте 📢+
            </div>
          )
        )}
        {sidebarTab === 'groups' && (
          filteredGroups.length > 0 ? (
            <GroupList
              groupChats={filteredGroups}
              activeChatId={activeChatId}
              unreadCounts={unreadCounts}
              onSelectChat={onSelectChat}
              formatMsgTime={formatMsgTime}
              groupChatsVersion={groupChatsVersion}
              currentUserId={user?.id}
              hideTitle
            />
          ) : (
            <div className="flex-1 flex items-center justify-center px-6 text-center text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
              Пока нет групп. Создайте через 👥+
            </div>
          )
        )}
      </div>

      {/* Нижняя панель — вкладки всегда у нижнего края */}
      <div className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-zinc-100 dark:border-zinc-900 flex flex-col gap-2 bg-zinc-50/50 dark:bg-zinc-950/20">
        <div className="flex gap-1">
          {tabBtn('chats', '💬', 'Чаты', chatsUnread)}
          {tabBtn('groups', '👥', 'Группы', groupsUnread)}
          {tabBtn('channels', '📢', 'Каналы', channelsUnread)}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-zinc-400 font-medium">Potok </span>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <button
                type="button"
                onClick={async () => {
                  setReportsOpen(true);
                  try {
                    const list = await apiClient('/api/reports');
                    setReports(Array.isArray(list) ? list : []);
                  } catch (_) {}
                }}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition text-zinc-500 dark:text-zinc-400"
                title="Жалобы"
              >
                🛡️
              </button>
            )}
            <button onClick={() => setIsSearchOpen(true)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition text-zinc-500 dark:text-zinc-400" title="Поиск (Ctrl+K)">🔍</button>
            <button onClick={onToggleTheme} className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-xl transition active:scale-95 shadow-sm">
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        {isNativeApp && <UpdateAppButton block />}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-400">
          <button type="button" onClick={openSupport} className="hover:text-emerald-500 transition">
            Техподдержка
          </button>
          <button type="button" onClick={() => setLegalPage('terms')} className="hover:text-emerald-500 transition">
            Соглашение
          </button>
          <button type="button" onClick={() => setLegalPage('privacy')} className="hover:text-emerald-500 transition">
            Конфиденциальность
          </button>
          {!isNativeApp && <DownloadAppButton compact />}
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
          if (String(chatId).startsWith('channel_')) switchTab('channels');
          else if (String(chatId).startsWith('chat_')) switchTab('groups');
          else switchTab('chats');
          if (typeof onSelectChat === 'function') onSelectChat(chatId, null, messageId);
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
      {reportsOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          onClick={() => setReportsOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[min(70dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">Жалобы</h3>
              <button type="button" onClick={() => setReportsOpen(false)} className="text-zinc-400">✕</button>
            </div>
            {reports.length === 0 ? (
              <p className="text-xs text-zinc-400">Жалоб пока нет</p>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <div key={r.id} className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-xs">
                    <div className="text-zinc-500">
                      #{r.id} · {r.reporter?.username || r.reporterId} · {new Date(r.createdAt).toLocaleString()}
                    </div>
                    <div className="text-zinc-800 dark:text-zinc-200 mt-1">{r.reason}</div>
                    <div className="text-zinc-400 mt-0.5">msg:{r.messageId || '—'} user:{r.targetUserId || '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {legalPage && LEGAL_PAGES[legalPage] && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          onClick={() => setLegalPage(null)}
        >
          <div
            className="w-full max-w-md h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">{LEGAL_PAGES[legalPage].title}</h3>
              <button type="button" onClick={() => setLegalPage(null)} className="text-zinc-400">✕</button>
            </div>
            <iframe
              title={LEGAL_PAGES[legalPage].title}
              src={LEGAL_PAGES[legalPage].path}
              className="flex-1 w-full border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>

  );
}