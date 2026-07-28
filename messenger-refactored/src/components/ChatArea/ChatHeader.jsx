import React from 'react';
import { getAvatarUrl } from '../../utils/avatarUtils';

export default function ChatHeader({ 
  chatName, 
  chatAvatar, 
  chatType, 
  isOnline, 
  isTyping, 
  isDataLoading,
  pinnedCount,
  onTogglePinned,
  onToggleProfile,
  onBack 
}) {
  const avatarUrl = chatAvatar && typeof chatAvatar === 'string' && chatAvatar.startsWith('/uploads/')
    ? getAvatarUrl(chatAvatar)
    : null;

  return (
    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/40">
      <div className="flex items-center flex-1 cursor-pointer select-none group" onClick={onToggleProfile}>
        {onBack && (
          <button 
            onClick={(e) => { e.stopPropagation(); onBack(); }} 
            className="md:hidden mr-3 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition text-zinc-500 dark:text-zinc-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        )}
        
        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg mr-3 shadow-inner group-hover:scale-105 transition-transform duration-200 overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={chatName} className="w-full h-full object-cover" />
          ) : (
            <span>{chatAvatar || '💬'}</span>
          )}
        </div>
        
        <div>
          <h2 className="font-semibold text-sm text-zinc-800 dark:text-white group-hover:text-emerald-500 transition-colors">
            {chatName}
          </h2>
          
          <span className="text-xs transition-colors duration-300">
            {isDataLoading ? (
              <span className="text-zinc-500 dark:text-zinc-600 animate-pulse">поиск в базе...</span>
            ) : isTyping ? ( 
              <span className="text-emerald-500 dark:text-emerald-400 animate-pulse">печатает...</span>
            ) : chatType === 'general' ? (
              <span className="text-zinc-400 dark:text-zinc-500">общий чат</span>
            ) : chatType === 'channel' ? (
              <span className="text-zinc-400 dark:text-zinc-500">канал</span>
            ) : isOnline ? (
              <span className="text-emerald-500 dark:text-emerald-400 font-medium">в сети</span>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">был(а) недавно</span>
            )}
          </span>

          {pinnedCount > 0 && (
  <button
    onClick={onTogglePinned}
    className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition flex items-center gap-1"
  >
    <span>📌</span>
    <span>{pinnedCount}</span>
  </button>
)}
        </div>
      </div>
      
      <button 
        onClick={onToggleProfile} 
        className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
      >
        ℹ️
      </button>
    </div>
  );
}