// src/components/Sidebar/CreateGroupModal.jsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';

export default function CreateGroupModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('💬');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchUsers = async () => {
      try {
        const data = await apiClient('/api/users');
        setAllUsers(data);
      } catch (err) {
        console.error('Ошибка загрузки пользователей:', err);
      }
    };
    fetchUsers();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || selectedUsers.length === 0) return;
    onCreate({ name: name.trim(), avatar, memberIds: selectedUsers });
    setName('');
    setAvatar('💬');
    setSelectedUsers([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-100 dark:border-zinc-800">
        <h3 className="text-lg font-bold text-zinc-800 dark:text-white mb-4">Создать групповой чат 👥</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Название чата</label>
            <input type="text" placeholder="Например: Команда проекта" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-sm focus:outline-none focus:border-blue-500 text-zinc-800 dark:text-white" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Иконка (эмодзи)</label>
            <input type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-center text-2xl focus:outline-none focus:border-blue-500" maxLength={2} placeholder="💬" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Участники ({selectedUsers.length})</label>
            <div className="max-h-40 overflow-y-auto space-y-1 bg-zinc-50 dark:bg-zinc-950 rounded-xl p-2 border border-zinc-200 dark:border-zinc-800">
              {allUsers.map((user) => (
                <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition">
                  <input type="checkbox" checked={selectedUsers.includes(user.dbId || user.id)} onChange={() => {
                    const id = user.dbId || user.id;
                    setSelectedUsers(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
                  }} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 flex-shrink-0" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{user.name || user.username}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition">Отмена</button>
            <button type="submit" disabled={selectedUsers.length === 0 || !name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-md">Создать чат</button>
          </div>
        </form>
      </div>
    </div>
  );
}