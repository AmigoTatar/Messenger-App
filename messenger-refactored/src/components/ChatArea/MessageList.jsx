import React, { useRef, useLayoutEffect, useCallback, useState, useEffect } from 'react';
import MessageItem from './MessageItem';
import { shareImage, saveImage } from '../../services/shareImage';

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
  socketRef, 
  onRetry,
  showToast = () => {},
}) {
  const containerRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isUserScrolledUp = useRef(false);
  const isMarking = useRef(false);
  const messagesEndRef = useRef(null);
  const topSensorRef = useRef(null);
  const pendingRestoreRef = useRef(null);
  const prevChatIdRef = useRef(activeChatId);
  const [previewIndex, setPreviewIndex] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [previewBusy, setPreviewBusy] = useState(false);
  const pinchRef = useRef({ dist: 0, startZoom: 1 });
  const swipeRef = useRef({ x: 0 });

  const imageUrls = (Array.isArray(messages) ? messages : [])
    .filter((m) => !m?.isDeleted && m?.mediaUrl && (m.mediaType === 'image' || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(m.mediaUrl)))
    .map((m) => m.mediaUrl);

  const openPreview = (url) => {
    const idx = imageUrls.indexOf(url);
    setPreviewIndex(idx >= 0 ? idx : 0);
    setZoom(1);
  };

  const closePreview = () => setPreviewIndex(-1);

  const handleShare = async (e) => {
    e.stopPropagation();
    const url = imageUrls[previewIndex];
    if (!url || previewBusy) return;
    setPreviewBusy(true);
    try {
      await shareImage(url);
    } catch (err) {
      showToast(err?.message || 'Не удалось поделиться фото', 'error');
    } finally {
      setPreviewBusy(false);
    }
  };

  const handleSave = async (e) => {
    e.stopPropagation();
    const url = imageUrls[previewIndex];
    if (!url || previewBusy) return;
    setPreviewBusy(true);
    try {
      const result = await saveImage(url);
      if (result === 'saved') showToast('Фото сохранено', 'success');
      if (result === 'shared') showToast('Выберите, куда сохранить фото', 'info');
      if (result === 'opened') showToast('Сохраните фото из открывшейся вкладки', 'info');
    } catch (err) {
      showToast(err?.message || 'Не удалось сохранить фото', 'error');
    } finally {
      setPreviewBusy(false);
    }
  };

  useEffect(() => {
    if (previewIndex < 0) return undefined;
    const onHwBack = (e) => {
      e.preventDefault();
      closePreview();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') closePreview();
      if (e.key === 'ArrowLeft') setPreviewIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setPreviewIndex((i) => Math.min(imageUrls.length - 1, i + 1));
    };
    window.addEventListener('potok-hardware-back', onHwBack);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('potok-hardware-back', onHwBack);
      window.removeEventListener('keydown', onKey);
    };
  }, [previewIndex, imageUrls.length]);

  useEffect(() => {
    setZoom(1);
  }, [previewIndex]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (prevChatIdRef.current !== activeChatId) {
      prevChatIdRef.current = activeChatId;
      pendingRestoreRef.current = null;
      isUserScrolledUp.current = false;
      container.scrollTop = container.scrollHeight;
      return;
    }
    if (pendingRestoreRef.current != null) {
      container.scrollTop = container.scrollHeight - pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      return;
    }
    if (!isUserScrolledUp.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, activeChatId]);

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
        }
        setTimeout(() => { isMarking.current = false; }, 500);
      }
    }

    if (scrollTop < 40 && !loading && hasMore && onLoadMore) {
      pendingRestoreRef.current = scrollHeight - scrollTop;
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
      <div className="flex-1 overflow-y-auto p-4 text-center text-zinc-500 dark:text-zinc-400 chat-wallpaper h-full">
        💬 Нет сообщений в этом чате
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 no-scrollbar chat-wallpaper"
    >
      <div ref={topSensorRef} className="h-1 w-full flex items-center justify-center text-xs text-zinc-500/50">
        {loading ? '⏳ Загрузка истории...' : ''}
      </div>

      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          msg={msg}
          currentUserId={currentUserId}
          isGroup={activeChatId?.startsWith('chat_')}
          onContextMenu={onContextMenu}
          onReactionToggle={onReactionToggle}
          onThreadReply={onThreadReply}
          onForward={onForward}
          onEdit={onEdit}
          onPin={onPin}
          onDelete={onDelete}
          onPreviewImage={openPreview}
          onRetry={onRetry}
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
      {previewIndex >= 0 && imageUrls[previewIndex] && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 flex flex-col"
          onClick={closePreview}
          role="button"
          tabIndex={0}
        >
          <div
            className="shrink-0 z-[81] flex justify-end gap-2 px-3 pb-2 pt-[max(2.75rem,calc(env(safe-area-inset-top,0px)+0.75rem))]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleSave}
              disabled={previewBusy}
              className="h-10 px-4 rounded-full bg-white/20 text-white text-sm font-medium disabled:opacity-50"
              aria-label="Скачать фото"
            >
              {previewBusy ? '…' : 'Скачать'}
            </button>
            <button
              type="button"
              onClick={handleShare}
              disabled={previewBusy}
              className="h-10 px-4 rounded-full bg-white/20 text-white text-sm font-medium disabled:opacity-50"
              aria-label="Поделиться фото"
            >
              Поделиться
            </button>
          </div>
          <div
            className="relative flex-1 min-h-0 flex items-center justify-center px-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                pinchRef.current = { dist: Math.hypot(dx, dy), startZoom: zoom };
              } else if (e.touches.length === 1) {
                swipeRef.current = { x: e.touches[0].clientX };
              }
            }}
            onTouchEnd={(e) => {
              if (zoom > 1.05) return;
              const startX = swipeRef.current.x;
              const endX = e.changedTouches?.[0]?.clientX;
              if (startX && endX) {
                const delta = endX - startX;
                if (delta > 50) setPreviewIndex((i) => Math.max(0, i - 1));
                if (delta < -50) setPreviewIndex((i) => Math.min(imageUrls.length - 1, i + 1));
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length !== 2 || !pinchRef.current.dist) return;
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const scale = Math.hypot(dx, dy) / pinchRef.current.dist;
              setZoom(Math.min(3, Math.max(1, pinchRef.current.startZoom * scale)));
            }}
          >
            <img
              src={imageUrls[previewIndex]}
              alt=""
              className="max-w-full max-h-full object-contain select-none"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              draggable={false}
            />
            {imageUrls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => { setPreviewIndex((i) => Math.max(0, i - 1)); setZoom(1); }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 text-white text-xl"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => { setPreviewIndex((i) => Math.min(imageUrls.length - 1, i + 1)); setZoom(1); }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 text-white text-xl"
                >
                  ›
                </button>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-white text-xs bg-black/40 px-2 py-1 rounded-full">
                  {previewIndex + 1} / {imageUrls.length}
                </div>
              </>
            )}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
              <button type="button" onClick={() => setZoom((z) => Math.max(1, Number((z - 0.4).toFixed(1))))} className="w-10 h-10 rounded-full bg-white/20 text-white text-xl">−</button>
              <button type="button" onClick={() => setZoom(1)} className="px-3 h-10 rounded-full bg-white/20 text-white text-xs">{Math.round(zoom * 100)}%</button>
              <button type="button" onClick={() => setZoom((z) => Math.min(3, Number((z + 0.4).toFixed(1))))} className="w-10 h-10 rounded-full bg-white/20 text-white text-xl">+</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}