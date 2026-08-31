
import React, { useState, useEffect } from 'react';

export default function CreateChannelModal({ isOpen, onClose, onCreate, showToast }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('📢');
  const [hasError, setHasError] = useState(false);

  // Сброс при открытии
  useEffect(() => {
    if (isOpen) {
      setHasError(false);
      setAvatar('📢');
      setName('');
    }
  }, [isOpen]);

  // Escape — закрываем только если нет ошибки
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
  e.stopPropagation();
  onClose();
}
      
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, hasError]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await onCreate({ name: name.trim(), avatar });
      setName('');
      setAvatar('📢');
      setHasError(false);
      onClose();
    } catch (err) {
      setHasError(true);
      console.error('Ошибка создания канала:', err);
      if (showToast) {
        showToast(err.message || 'Не удалось создать канал', 'error');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 sheet-safe">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-zinc-100 dark:border-zinc-800">
        <h3 className="text-lg font-bold text-zinc-800 dark:text-white mb-4">Создать новый канал</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Иконка / Эмодзи</label>
            <input 
              type="text" 
              value={avatar} 
              onChange={(e) => setAvatar(e.target.value)} 
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-center text-xl focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white" 
              maxLength={2} 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Название канала</label>
            <input 
              type="text" 
              placeholder="Например: Новости IT" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white" 
              required 
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
<button 
  type="button" 
  onClick={() => onClose()} 
  className="..."
>
  Отмена
</button>
            <button 
              type="submit" 
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-md"
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}