// src/components/Sidebar/UserProfile.jsx
import React, { useState } from 'react';
import { getAvatarUrl } from '../../utils/avatarUtils';

export default function UserProfile({ user, onUpdateUser }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.username || '');

  const handleSave = async () => {
    if (!editName.trim() || editName === user?.username) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5001/api/users/profile', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: editName.trim() }),
      });
      if (!res.ok) throw new Error('Ошибка');
      const data = await res.json();
      const updated = { ...user, username: data.user.username };
      localStorage.setItem('user', JSON.stringify(updated));
      if (onUpdateUser) onUpdateUser(updated);
      setIsEditing(false);
    } catch (err) {
      alert('Не удалось изменить имя');
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5001/api/users/avatar', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Ошибка');
      const data = await res.json();
      const updated = { ...user, avatar: data.user.avatar };
      localStorage.setItem('user', JSON.stringify(updated));
      if (onUpdateUser) onUpdateUser(updated);
    } catch (err) {
      alert('Не удалось загрузить аватарку');
    }
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50">
      {/* Аватар с возможностью загрузки */}
      <div className="relative w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden group">
        {user?.avatar?.startsWith('/uploads/') ? (
          <img src={getAvatarUrl(user.avatar)} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <span>{user?.avatar || '👤'}</span>
        )}
        <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-full">
          <span className="text-white text-xs font-medium">📷</span>
        </label>
        <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      </div>

      {/* Имя пользователя с редактированием */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white"
              autoFocus
            />
            <button onClick={handleSave} className="px-2 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition">💾</button>
            <button onClick={() => { setIsEditing(false); setEditName(user?.username || ''); }} className="px-2 py-1 text-xs font-medium bg-zinc-600 hover:bg-zinc-500 text-white rounded-lg transition">✕</button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-800 dark:text-white truncate">{user?.username || 'Пользователь'}</p>
            <button onClick={() => setIsEditing(true)} className="text-xs text-zinc-400 hover:text-emerald-400 transition opacity-60 hover:opacity-100" title="Изменить имя">✏️</button>
          </div>
        )}
        {user?.email && <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{user.email}</p>}
      </div>
    </div>
  );
}