import React from 'react';
import ChatListItem from './ChatListItem';

export default function GroupList({ 
  groupChats, 
  activeChatId, 
  unreadCounts, 
  onSelectChat, 
  formatMsgTime,
  groupChatsVersion  // ← ДОБАВЛЯЕМ ПРОПС
  
}) {
  console.log('🔍 GroupList рендерится, version:', groupChatsVersion, 'groups:', groupChats.length);
  if (!groupChats || groupChats.length === 0) return null;
  

  return (
    <>
      <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
        <span>👥 Групповые чаты</span>
        <span className="text-[9px] text-zinc-500">({groupChats.length})</span>
      </div>

      {groupChats.map((chat) => {
        const chatId = chat.id || `chat_${chat.dbId}`;
        const unreadCount = unreadCounts[chatId] || 0;
        return (
          <ChatListItem
            key={`group-${chat.id}-${groupChatsVersion}`} 
            id={chatId}
            name={chat.name}
            avatar={chat.avatar}
            lastMessage={chat.lastMessage}
            unreadCount={unreadCount}
            isActive={chatId === activeChatId}
            isMuted={chat.muted}
            onClick={() => onSelectChat(chatId)}
            formatMsgTime={formatMsgTime}
            type="group"
          />
        );
      })}
    </>
  );
}