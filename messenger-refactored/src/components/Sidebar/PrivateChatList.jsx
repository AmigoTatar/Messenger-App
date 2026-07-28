// src/components/Sidebar/PrivateChatList.jsx
import React from 'react';
import ChatListItem from './ChatListItem';

export default function PrivateChatList({ 
  chats, 
  activeChatId, 
  unreadCounts, 
  onSelectChat, 
  formatMsgTime,
  chatsVersion  // ← добавить пропс
}) {
  const privateChats = chats?.filter(chat => chat.id !== 'chat_general' && chat.id !== 'general') || [];

  if (privateChats.length === 0) return null;

  return (
    <>
      <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
        <span>👤 Приватные чаты</span>
        <span className="text-[9px] text-zinc-500">({privateChats.length})</span>
      </div>

      {privateChats.map((chat) => {
        const chatId = chat.id;
        const unreadCount = unreadCounts[chatId] || 0;
        return (
          <ChatListItem
            key={`${chatId}-${chatsVersion}`} // ← добавить chatsVersion
            id={chatId}
            name={chat.name}
            avatar={chat.avatar}
            lastMessage={chat.lastMessage}
            unreadCount={unreadCount}
            isActive={chatId === activeChatId}
            isOnline={chat.isOnline}
            isMuted={chat.muted}
            onClick={() => onSelectChat(chatId)}
            formatMsgTime={formatMsgTime}
            type="private"
          />
        );
      })}
    </>
  );
}