// src/components/Sidebar/ChannelList.jsx
import React from 'react';
import ChatListItem from './ChatListItem';

export default function ChannelList({ 
  channels, 
  activeChatId, 
  unreadCounts, 
  onSelectChat, 
  formatMsgTime,
  channelsVersion 
}) {
  if (!channels || channels.length === 0) return null;

  return (
    <>
      <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
        <span>📢 Каналы</span>
        <span className="text-[9px] text-zinc-500">({channels.length})</span>
      </div>

      {channels.map((channel) => {
        const chatId = `channel_${channel.id}`;
        const unreadCount = unreadCounts[chatId] || 0;
        return (
          <ChatListItem
            key={`${chatId}-${channelsVersion}`}
            id={chatId}
            name={channel.name}
            avatar={channel.avatar}
            lastMessage={channel.lastMessage}
            unreadCount={unreadCount}
            isActive={chatId === activeChatId}
            isMuted={channel.muted}
            onClick={() => {
              if (typeof onSelectChat === 'function') {
                onSelectChat(chatId);
              } else {
                console.error('❌ ChannelList: onSelectChat не является функцией! Невозможно переключить канал.');
              }
            }}
            formatMsgTime={formatMsgTime}
            type="channel"
          />
        );
      })}
    </>
  );
}