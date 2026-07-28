import React, { useState } from 'react';

export default function EditModal({ message, onSave, onCancel }) {
  const [text, setText] = useState(message?.text || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await onSave(message.id, text.trim());
      onCancel();
    } catch (err) {
      /*alert('Не удалось отредактировать');*/
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <h3 className="text-lg font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
          <span>✏️</span> Редактировать сообщение
        </h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white resize-none min-h-[80px]"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
            disabled={loading}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Сохранение...
              </>
            ) : (
              'Сохранить'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}