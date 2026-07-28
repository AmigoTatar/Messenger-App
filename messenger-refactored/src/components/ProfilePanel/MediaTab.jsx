// src/components/ProfilePanel/MediaTab.jsx
import React from 'react';

export default function MediaTab({ messages, onMediaClick }) {
  const mediaImages = messages.filter(msg => msg && msg.mediaType === 'image' && !msg.isDeleted);

  if (mediaImages.length === 0) {
    return (
      <p className="text-xs italic text-center py-4 rounded-xl border border-dashed text-zinc-400 bg-zinc-100/20 border-zinc-300/40 dark:text-zinc-500 dark:bg-zinc-900/20 dark:border-zinc-800/40">
        Нет отправленных изображений
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {mediaImages.map(msg => (
        <div
          key={msg.id}
          onClick={() => onMediaClick(msg.id)}
          className="aspect-square rounded-lg overflow-hidden border group relative cursor-pointer bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800"
        >
          <img src={msg.mediaUrl} alt="Shared" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      ))}
    </div>
  );
}