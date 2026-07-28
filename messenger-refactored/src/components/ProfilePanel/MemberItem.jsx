// src/components/ProfilePanel/MemberItem.jsx
import React from 'react';
import { getAvatarUrl } from '../../utils/avatarUtils';

export default function MemberItem({ member, currentUserId, isAdmin, onRemove }) {
  const user = member.user || {};
  const username = user.username || 'Неизвестный';
  const avatar = user.avatar || '👤';
  const role = member.role || 'member';
  const isSelf = member.userId === currentUserId;

  return (
    <div className="flex items-center justify-between p-2 rounded-lg transition bg-zinc-100/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm overflow-hidden bg-zinc-200 dark:bg-zinc-800">
          {avatar.startsWith('/uploads/') ? (
            <img src={getAvatarUrl(avatar)} alt={username} className="w-full h-full object-cover" />
          ) : (
            <span>{avatar}</span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {username}
            {isSelf && <span className="ml-1.5 text-[10px] text-emerald-400 dark:text-emerald-500 font-medium">(Вы)</span>}
          </p>
          <span className="text-xs text-zinc-500 dark:text-zinc-500">
            {role === 'admin' ? '👑 Админ' : '👤 Участник'}
          </span>
        </div>
      </div>
      {isAdmin && role !== 'admin' && !isSelf && (
        <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-300 transition opacity-50 hover:opacity-100">
          Удалить
        </button>
      )}
    </div>
  );
}