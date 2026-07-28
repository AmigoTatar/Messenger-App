// src/components/ProfilePanel/DeleteChatButton.jsx
import React from 'react';

export default function DeleteChatButton({ type, onDelete, isCreator, chatName }) {
  if (!isCreator) return null;

  const label = type === 'channel' ? 'канал' : 'групповой чат';
  const confirmMessage = `Вы уверены, что хотите удалить ${label} "${chatName}"? Это действие необратимо!`;

  const handleClick = () => {
    if (window.confirm(confirmMessage)) {
      onDelete();
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-zinc-800/60">
      <button
        onClick={handleClick}
        className="w-full py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
      >
        <span>🗑️</span>
        Удалить {label}
      </button>
    </div>
  );
}