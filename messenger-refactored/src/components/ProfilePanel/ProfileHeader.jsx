import React from 'react';
import Avatar from '../Avatar';

export default function ProfileHeader({ activeChat, onClose }) {
  const avatar = activeChat?.avatar || '💬';
  const name = activeChat?.name || 'Чат';
  const type = activeChat?.type || 'chat';

  return (
    <div className="flex flex-col items-center text-center space-y-3">
      <Avatar
        avatar={avatar}
        name={name}
        type={type === 'channel' ? 'channel' : type === 'group' ? 'group' : 'private'}
        size="2xl"
        className="shadow-lg border-2 border-zinc-300/50 dark:border-zinc-700/50 text-5xl"
      />
      <div>
        <h2 className="font-bold text-lg leading-tight text-zinc-900 dark:text-white">{name}</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {type === 'channel' ? '📢 Канал' : type === 'group' ? '👥 Групповой чат' : '💬 Чат'}
        </span>
      </div>
    </div>
  );
}
