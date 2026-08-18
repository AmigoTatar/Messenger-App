import React from 'react';
import Avatar from '../Avatar';

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
  onDelete,
  formatMsgTime,
  type, // 'private', 'channel', 'group'
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.(e);
      }}
      className={`w-full flex items-center p-3 rounded-xl transition-all select-none text-left cursor-pointer ${
        isActive
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30'
          : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
      }`}
    >
      <div className="relative mr-3 shrink-0">
        <Avatar avatar={avatar} name={name} type={type} size="lg" />
        {type === 'private' && (
          <span
            className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-white dark:border-zinc-950 ${
              isOnline ? 'bg-emerald-500 ring-1 ring-emerald-500/20' : 'bg-zinc-400 dark:bg-zinc-500'
            }`}
          />
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
      {onDelete && (
        <button
          type="button"
          title="Удалить контакт"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1 p-1.5 text-zinc-400 hover:text-red-500 rounded-lg shrink-0"
        >
          🗑
        </button>
      )}
    </div>
  );
}
