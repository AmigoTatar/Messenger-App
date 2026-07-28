
import React, { useRef, useEffect } from 'react';
import { getAvatarUrl } from '../../utils/avatarUtils';

export default function ContextMenu({
  message,
  currentUserId,
  onClose,
  position,
  onCopy,
  onEdit,
  onReply,
  onForward,
  onPin,
  onDelete,
  onReaction,
  canDelete,
}) {
  const menuRef = useRef(null);

  // Закрываем при клике вне меню
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  // Если сообщение отсутствует, не рендерим
  if (!message) return null;

  const isOwn = Number(message.senderId) === Number(currentUserId);
  const textToCopy = message.text || message.content || message.message || '';
  const isDeleted = message.isDeleted === true;

  // Сборка реакций для отображения
  const reactionCounts = {};
  if (message.reactions) {
    message.reactions.forEach(r => {
      reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
    });
  }

  const emojis = ['😊', '😂', '❤️', '🔥', '👏', '😮', '💪', '🎉', '👍', '👎'];

  // Ограничиваем позицию, чтобы меню не выходило за экран
  const menuStyle = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - 400),
    left: Math.min(position.x, window.innerWidth - 240),
    zIndex: 50,
  };

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 py-1.5 w-56 rounded-xl shadow-2xl text-sm text-zinc-700 dark:text-zinc-200 overflow-hidden"
    >
      {/* Копировать текст */}
      {!isDeleted && textToCopy && (
        <button
          onClick={() => {
            onCopy(textToCopy);
            onClose();
          }}
          className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-3"
        >
          <span className="text-base">📋</span>
          <span>Копировать текст</span>
        </button>
      )}

      {/* Редактировать (только свои) */}
      {!isDeleted && isOwn && (
        <button
          onClick={() => {
            onEdit(message);
            onClose();
          }}
          className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-3"
        >
          <span className="text-base">✏️</span>
          <span>Редактировать</span>
        </button>
      )}

      {/* Ответить */}
      {!isDeleted && (
        <button
          onClick={() => {
            onReply(message);
            onClose();
          }}
          className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-3"
        >
          <span className="text-base">💬</span>
          <span>Ответить</span>
        </button>
      )}

      {/* Переслать */}
      {!isDeleted && (
        <button
          onClick={() => {
            onForward(message);
            onClose();
          }}
          className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-3"
        >
          <span className="text-base">📤</span>
          <span>Переслать</span>
        </button>
      )}

      {/* Закрепить/открепить */}
      {!isDeleted && (
        <>
          <div className="border-t border-zinc-200 dark:border-zinc-700/50 my-1" />
          <button onClick={() => {onPin(message.id);onClose();}}
            className={`w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition flex items-center gap-3 ${
              message.isPinned ? 'text-amber-500 dark:text-amber-400' : ''
            }`}
          >
            <span className="text-base">📌</span>
            <span>{message.isPinned ? 'Открепить' : 'Закрепить'}</span>
            {message.isPinned && (
              <span className="ml-auto text-[10px] text-amber-500 dark:text-amber-400 font-medium">✓</span>
            )}
          </button>
        </>
      )}

      {/* Реакции */}
      <div className="border-t border-zinc-200 dark:border-zinc-700/50 my-1" />
      <div className="px-3 py-2">
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">
          Реакции
        </div>
        <div className="flex gap-1 flex-wrap">
          {emojis.map(emoji => {
            const isActive = message.reactions?.some(r => r.userId === currentUserId && r.type === emoji);
            const count = reactionCounts[emoji] || 0;
            return (
              <button
                key={emoji}
                onClick={() => {
                  onReaction(message.id, emoji);
                  onClose();
                }}
                className={`text-lg px-1.5 py-0.5 rounded transition select-none hover:scale-110 ${
                  isActive
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-400'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-700/50'
                }`}
              >
                {emoji}
                {count > 0 && (
                  <span className={`text-[10px] ml-0.5 ${isActive ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Удалить (если есть права) */}
      {canDelete && (
        <>
          <div className="border-t border-zinc-200 dark:border-zinc-700/50 my-1" />
          <button
            onClick={() => {
              if (window.confirm('Удалить это сообщение?')) {
                onDelete(message.id);
              }
              onClose();
            }}
            className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 transition flex items-center gap-3"
          >
            <span className="text-base">🗑️</span>
            <span>Удалить сообщение</span>
          </button>
        </>
      )}
    </div>
  );
}