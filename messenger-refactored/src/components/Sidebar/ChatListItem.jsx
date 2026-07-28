// src/components/Sidebar/ChatListItem.jsx
import React from 'react';
import { getAvatarUrl } from '../../utils/avatarUtils';

export default function ChatListItem({
  id,
  name,
  avatar,
  lastMessage,
  unreadCount,
  isActive,
  isOnline,
  isMuted,
  onClick,
  formatMsgTime,
  type, // 'private', 'channel', 'group'
}) {
  const isImageAvatar = avatar && typeof avatar === 'string' && avatar.startsWith('/uploads/');

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center p-3 rounded-xl transition-all select-none text-left ${
        isActive
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30'
          : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
      }`}
    >
      <div className="relative mr-3 shrink-0">
        <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl shadow-sm overflow-hidden">
          {isImageAvatar ? (
            <img src={getAvatarUrl(avatar)} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span>{avatar || (type === 'channel' ? '📢' : type === 'group' ? '💬' : '👤')}</span>
          )}
        </div>
        {isOnline && type === 'private' && (
          <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950 ring-1 ring-emerald-500/20 animate-pulse" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <div className="flex items-center gap-1">
            <h3 className="font-semibold text-xs text-zinc-800 dark:text-zinc-100 truncate">{name}</h3>
            {isMuted && <span className="text-[10px] text-amber-500" title="Уведомления отключены">🔕</span>}
          </div>
          {lastMessage && (
            <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-1">
              {formatMsgTime(lastMessage.createdAt)}
            </span>
          )}
        </div>

        <div className="flex justify-between items-center gap-2">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate flex-1">
            {lastMessage
              ? lastMessage.isDeleted
                ? '🚫 Сообщение удалено'
                : lastMessage.mediaType === 'image'
                ? '🖼️ Фотография'
                : lastMessage.mediaType === 'audio'
                ? '🎙️ Голосовое сообщение'
                : lastMessage.text || 'Медиафайл'
              : type === 'channel'
              ? '📢 Канал'
              : type === 'group'
              ? 'Нет сообщений'
              : 'Нет сообщений'}
          </p>
          {unreadCount > 0 && (
            <span className={`text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center select-none shrink-0 ${
              isMuted ? 'bg-gray-500' : 'bg-emerald-500'
            }`}>
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}