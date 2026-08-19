import React, { useEffect, useRef, useState } from 'react';
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
  menuLabel = 'Скрыть контакт',
  menuDanger = true,
  actionLabel,
  formatMsgTime,
  type, // 'private', 'channel', 'group'
  currentUserId,
}) {
  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);
  const longPressTimer = useRef(null);
  const skipClickRef = useRef(false);

  const closeMenu = () => setMenu(null);

  useEffect(() => {
    if (!menu) return undefined;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeMenu();
    };
    const onHwBack = (e) => {
      e.preventDefault();
      closeMenu();
    };
    const timer = setTimeout(() => document.addEventListener('click', onDocClick), 80);
    window.addEventListener('potok-hardware-back', onHwBack);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('potok-hardware-back', onHwBack);
    };
  }, [menu]);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openMenuAt = (x, y) => {
    if (!onDelete) return;
    setMenu({
      x: Math.min(x, window.innerWidth - 200),
      y: Math.min(y, window.innerHeight - 80),
    });
  };

  return (
    <>
      <div
        onClick={(e) => {
          if (skipClickRef.current) {
            skipClickRef.current = false;
            e.preventDefault();
            return;
          }
          if (menu) {
            closeMenu();
            return;
          }
          onClick?.(e);
        }}
        onContextMenu={(e) => {
          if (!onDelete) return;
          e.preventDefault();
          e.stopPropagation();
          openMenuAt(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          if (!onDelete) return;
          const touch = e.touches?.[0];
          if (!touch) return;
          longPressTimer.current = setTimeout(() => {
            skipClickRef.current = true;
            openMenuAt(touch.clientX, touch.clientY);
          }, 480);
        }}
        onTouchEnd={clearLongPress}
        onTouchMove={clearLongPress}
        onTouchCancel={clearLongPress}
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
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
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
            {unreadCount > 0 ? (
              <span className={`text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center select-none shrink-0 ${
                isMuted ? 'bg-gray-500' : 'bg-emerald-500'
              }`}>
                {unreadCount}
              </span>
            ) : lastMessage && Number(lastMessage.senderId) === Number(currentUserId) ? (
              <span className="text-[11px] shrink-0 text-emerald-500 dark:text-emerald-400 font-semibold">
                {lastMessage.status === 'read' || lastMessage.isRead ? '✓✓' : '✓'}
              </span>
            ) : null}
          </div>
        </div>
        {actionLabel && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="ml-1 shrink-0 px-2 py-1 text-[10px] font-medium rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {menu && onDelete && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 60 }}
          className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 py-1.5 w-48 rounded-xl shadow-2xl text-sm text-zinc-700 dark:text-zinc-200 overflow-hidden"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeMenu();
              onDelete();
            }}
            className={`w-full text-left px-4 py-2 transition flex items-center gap-3 ${
              menuDanger
                ? 'hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400'
                : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <span>{menuLabel}</span>
          </button>
        </div>
      )}
    </>
  );
}
