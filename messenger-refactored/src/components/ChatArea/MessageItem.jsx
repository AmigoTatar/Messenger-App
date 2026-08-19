
import React, { useRef } from 'react';
import Avatar, { SafeImage } from '../Avatar';
import DOMPurify from 'dompurify';

export default function MessageItem({ 
  msg, 
  currentUserId, 
  isGroup,
  onContextMenu,
  onPreviewImage,
  onRetry,
}) {
  const longPressTimer = useRef(null);

  if (!msg || typeof msg !== 'object') {
    return (
      <div className="text-xs text-zinc-400 p-2 border border-dashed border-zinc-300 rounded-lg my-1">
        ⚠️ Некорректное сообщение
      </div>
    );
  }

  if (msg.isDeleted) {
    return (
      <div className="flex w-full mb-2 justify-center">
        <div className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 text-xs px-4 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700/50 select-none">
          🗑️ Сообщение удалено
        </div>
      </div>
    );
  }

  const isOwn = Number(msg.senderId) === Number(currentUserId);
  const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const text = msg.text || '';
  const mediaUrl = msg.mediaUrl || null;
  const mediaType = msg.mediaType || null;
  const isPinned = msg.isPinned || false;
  const isForwarded = msg.isForwarded || false;
  const reactions = msg.reactions || [];
  const threads = msg.threads || [];

  const handleContext = (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    onContextMenu?.(e, msg);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onTouchStart = (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    longPressTimer.current = setTimeout(() => {
      onContextMenu?.(
        { preventDefault() {}, clientX: touch.clientX, clientY: touch.clientY },
        msg
      );
    }, 480);
  };

  const isImage = mediaType === 'image' || (mediaUrl && mediaUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i));

return (
  <div className={`flex flex-col w-full mb-2 ${isOwn ? 'items-end' : 'items-start'}`}>
    {isGroup && !isOwn && (
      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-0.5 ml-1">
        {msg.sender?.username || 'Неизвестный'}
      </span>
    )}

    <div 
      className={`flex w-full items-end gap-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}
      onContextMenu={handleContext}
      onTouchStart={onTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
      data-message-id={msg.id}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      {!isOwn && (
        <Avatar
          avatar={msg.sender?.avatar}
          name={msg.sender?.username}
          size="xs"
          className="mb-0.5"
        />
      )}
      <div 
        className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm relative group text-sm ${
          isOwn
            ? 'bg-emerald-600 text-white rounded-br-none'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-bl-none border border-zinc-200/60 dark:border-transparent'
        } ${isPinned ? 'ring-2 ring-amber-400 dark:ring-amber-500 ring-offset-1 dark:ring-offset-zinc-900' : ''}`}
      >

        {msg.replyTo && (
          <div className={`mb-1.5 px-2 py-1 rounded-lg border-l-2 text-left ${
            isOwn
              ? 'bg-emerald-700/40 border-emerald-200/70'
              : 'bg-zinc-200/70 dark:bg-zinc-900/60 border-emerald-500/70'
          }`}>
            <div className={`text-[10px] font-semibold truncate ${isOwn ? 'text-emerald-50' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {msg.replyTo.sender?.username || 'Сообщение'}
            </div>
            <div className={`text-xs truncate opacity-80 ${isOwn ? 'text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
              {msg.replyTo.text || 'Медиа'}
            </div>
          </div>
        )}

        {isImage && mediaUrl && (
          <div className="mb-2 max-w-full overflow-hidden rounded-lg bg-zinc-900/50 min-h-[80px]">
            <SafeImage
              src={msg.mediaUrl}
              alt="Вложение"
              className="max-h-60 w-full object-cover cursor-pointer hover:opacity-90 transition"
              onClick={() => onPreviewImage?.(mediaUrl)}
              fallback="🖼️"
            />
          </div>
        )}

        {mediaType === 'audio' && mediaUrl && (
          <div className="mb-2 p-1 bg-zinc-100/80 dark:bg-zinc-950/60 rounded-xl flex items-center gap-2 min-w-[240px] border border-zinc-200 dark:border-zinc-800/50">
            <audio 
              src={msg.mediaUrl} 
              controls 
              className="w-full h-8 accent-emerald-500" 
            />
          </div>
        )}

        {text && (
          <p 
    className="break-words whitespace-pre-wrap" 
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(text) }} 
/> )}

        <div className={`text-[10px] font-normal flex items-center justify-end gap-1 mt-1 select-none ${
          isOwn ? 'text-emerald-100/90' : 'text-zinc-400 dark:text-zinc-500'
        }`}>
          {isForwarded && (
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium mr-1 flex items-center gap-0.5">
              📤 Переслано
            </span>
          )}
          {isPinned && (
            <span className="text-amber-500 dark:text-amber-400 text-[10px] font-medium flex items-center gap-0.5">📌</span>
          )}
          {msg.edited && (
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 italic">(изменено)</span>
          )}
          <span>{time}</span>
          {isOwn && !msg.failed && (
            <span className="text-xs font-bold leading-none">
              {msg.pending ? (
                <span className="text-emerald-200/50">⏳</span>
              ) : msg.status === 'read' || msg.isRead === true ? (
                <span className="text-cyan-200 dark:text-cyan-400">✓✓</span>
              ) : (
                <span className="text-emerald-200/60">✓</span>
              )}
            </span>
          )}
        </div>

        {msg.failed && (
          <button
            type="button"
            onClick={() => onRetry?.(msg)}
            className={`mt-1 text-[11px] font-medium underline-offset-2 hover:underline ${
              isOwn ? 'text-red-100' : 'text-red-500'
            }`}
          >
            Не удалось отправить · Повторить
          </button>
        )}

        {reactions.length > 0 && (
          <div className="flex items-center gap-0.5 mt-1.5 flex-wrap">
            {Object.entries(
              reactions.reduce((acc, r) => {
                acc[r.type] = (acc[r.type] || 0) + 1;
                return acc;
              }, {})
            ).map(([emoji, count]) => (
              <span 
                key={emoji} 
                className="inline-flex items-center gap-0.5 text-sm px-1.5 py-0.5 rounded-full 
                  bg-zinc-100/80 dark:bg-zinc-800/60 
                  border border-zinc-200/50 dark:border-zinc-700/30 shadow-sm"
              >
                <span className="text-base leading-none">{emoji}</span>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                  {count}
                </span>
              </span>
            ))}
          </div>
        )}

        {threads.length > 0 && (
          <div className="mt-2 space-y-1.5 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg p-2 border border-zinc-200/50 dark:border-zinc-700/30">
            <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
              <span>💬</span>
              <span>Комментарии</span>
              <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-200/50 dark:bg-zinc-700/30 px-1.5 py-0.5 rounded-full">
                {threads.length}
              </span>
            </div>
            {threads.map((thread) => (
              <div key={thread.id} className="text-xs flex items-start gap-1.5">
                <span className="font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  {thread.user?.username || 'Неизвестный'}:
                </span>
                <span className="text-blue-600 dark:text-blue-400 break-words">
                  {thread.text}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap ml-auto font-medium">
                  {new Date(thread.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}