// src/components/ProfilePanel/AudioTab.jsx
import React from 'react';

export default function AudioTab({ messages, onMediaClick }) {
  const audioFiles = messages.filter(msg => msg && msg.mediaType === 'audio' && !msg.isDeleted);

  if (audioFiles.length === 0) {
    return (
      <p className="text-xs italic text-center py-4 rounded-xl border border-dashed text-zinc-400 bg-zinc-100/20 border-zinc-300/40 dark:text-zinc-500 dark:bg-zinc-900/20 dark:border-zinc-800/40">
        Нет отправленных аудиосообщений
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {audioFiles.map(msg => (
        <div
          key={msg.id}
          onClick={() => onMediaClick(msg.id)}
          className="p-2.5 border rounded-xl flex items-center gap-3 cursor-pointer transition-colors bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80 border-zinc-300 dark:border-zinc-800"
        >
          <div className="text-xl p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800">🎙️</div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] block mb-1 text-zinc-400 dark:text-zinc-500">
              {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : 'Голосовое сообщение'}
            </span>
            <audio src={msg.mediaUrl || msg.audio || msg.fileUrl || ""} controls className="w-full h-6 text-xs filter invert-0 dark:invert opacity-70 hover:opacity-100" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      ))}
    </div>
  );
}