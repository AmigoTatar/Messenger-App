// src/components/ProfilePanel/ProfileHeader.jsx
import React from 'react';
import { getAvatarUrl } from '../../utils/avatarUtils';

export default function ProfileHeader({ activeChat, onClose }) {
  const avatar = activeChat?.avatar || '💬';
  const name = activeChat?.name || 'Чат';
  const type = activeChat?.type || 'chat';

  const isImage = typeof avatar === 'string' && avatar.startsWith('/uploads/');

  return (
    <div className="flex flex-col items-center text-center space-y-3">
      <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-lg border-2 overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-zinc-300/50 dark:border-zinc-700/50">
        {isImage ? (
          <img src={getAvatarUrl(avatar)} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{avatar}</span>
        )}
      </div>
      <div>
        <h2 className="font-bold text-lg leading-tight text-zinc-900 dark:text-white">{name}</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {type === 'channel' ? '📢 Канал' : type === 'group' ? '👥 Групповой чат' : '💬 Чат'}
        </span>
      </div>
    </div>
  );
}