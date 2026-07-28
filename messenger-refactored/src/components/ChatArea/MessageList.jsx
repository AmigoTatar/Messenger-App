import React, { useRef, useEffect, useCallback, useState } from 'react';
import MessageItem from './MessageItem';

export default function MessageList({
  messages,
  currentUserId,
  activeChatId,
  onLoadMore,
  hasMore,
  loading,
  onContextMenu,
  onReactionToggle,
  onThreadReply,
  onForward,
  onEdit,
  onPin,
  onDelete,
  socketRef, // новый проп
}) {
  const containerRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isUserScrolledUp = useRef(false);
  const isMarking = useRef(false);
  const messagesEndRef = useRef(null);
  const topSensorRef = useRef(null);

  // Эффект для автоскролла
  useEffect(() => {
    if (!isUserScrolledUp.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  // Обработка скролла
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom > 200) {
      isUserScrolledUp.current = true;
      setShowScrollBtn(true);
    } else {
      isUserScrolledUp.current = false;
      setShowScrollBtn(false);
      setUnreadCount(0);

      // Если доскроллили до низа и есть активный чат, отправляем read_messages через сокет
      if (distanceFromBottom < 50 && activeChatId && !isMarking.current) {
        isMarking.current = true;
        if (socketRef && socketRef.connected) {
          socketRef.emit('read_messages', { activeChatId });
          console.log('📤 Отправлено read_messages для чата:', activeChatId);
        }
        setTimeout(() => { isMarking.current = false; }, 500);
      }
    }

    if (scrollTop < 40 && !loading && hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [onLoadMore, loading, hasMore, activeChatId, socketRef]);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
      isUserScrolledUp.current = false;
      setShowScrollBtn(false);
      setUnreadCount(0);
    }
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 text-center text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-950/20 h-full">
        💬 Нет сообщений в этом чате
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-white dark:bg-zinc-950/20"
    >
      <div ref={topSensorRef} className="h-1 w-full flex items-center justify-center text-xs text-zinc-500/50">
        {loading ? '⏳ Загрузка истории...' : ''}
      </div>

      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          msg={msg}
          currentUserId={currentUserId}
          onContextMenu={onContextMenu}
          onReactionToggle={onReactionToggle}
          onThreadReply={onThreadReply}
          onForward={onForward}
          onEdit={onEdit}
          onPin={onPin}
          onDelete={onDelete}
        />
      ))}

      <div ref={messagesEndRef} className="h-0 w-full" />

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 w-10 h-10 bg-zinc-800 dark:bg-zinc-700 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95 group z-40"
        >
          <span className="text-sm font-bold group-hover:translate-y-0.5 transition-transform duration-200">↓</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border border-zinc-900">
              {unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}