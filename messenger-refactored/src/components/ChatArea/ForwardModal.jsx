// components/ChatArea/ForwardModal.jsx
import React, { useState, useEffect } from 'react';
import { getAvatarUrl } from '../../utils/avatarUtils';

export default function ForwardModal({
  visible,
  onClose,
  message,
  chats,
  groupChats,
  channels,
  onForward,
}) {
  const [search, setSearch] = useState('');

  // Сброс поиска при открытии/закрытии
  useEffect(() => {
    if (!visible) {
      setSearch('');
    }
  }, [visible]);

  if (!visible || !message) return null;

  const handleForward = (targetChatId) => {
    onForward(targetChatId, message);
    onClose();
  };

  // Фильтрация
  const filteredChats = (chats || []).filter(chat =>
    chat.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredGroups = (groupChats || []).filter(chat =>
    chat.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredChannels = (channels || []).filter(channel =>
    channel.name.toLowerCase().includes(search.toLowerCase())
  );

  const hasResults = filteredChats.length > 0 || filteredGroups.length > 0 || filteredChannels.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-zinc-800 dark:text-white">
            📤 Переслать сообщение
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Предпросмотр сообщения */}
        <div className="mb-3 p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl text-sm text-zinc-600 dark:text-zinc-300 max-h-16 overflow-y-auto border border-zinc-200/50 dark:border-zinc-700/50">
          {message.text || '📎 Медиафайл'}
        </div>

        {/* Поиск */}
        <div className="relative mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Поиск чатов..."
            className="w-full bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white placeholder-zinc-400"
            autoFocus
          />
        </div>

        {/* Список чатов */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {!hasResults ? (
            <div className="text-center text-zinc-400 py-8 text-sm">
              💬 Нет доступных чатов для пересылки
            </div>
          ) : (
            <>
              {/* Приватные чаты */}
              {filteredChats.length > 0 && (
                <>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pt-2 pb-1 px-1 font-medium">
                    👤 Приватные
                  </div>
                  {filteredChats.map(chat => (
                    <ChatButton
                      key={chat.id}
                      chat={chat}
                      onClick={() => handleForward(chat.id)}
                      avatar={chat.avatar}
                      name={chat.name}
                      type="приватный"
                    />
                  ))}
                </>
              )}

              {/* Группы */}
              {filteredGroups.length > 0 && (
                <>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pt-2 pb-1 px-1 font-medium">
                    👥 Группы
                  </div>
                  {filteredGroups.map(chat => (
                    <ChatButton
                      key={chat.id}
                      chat={chat}
                      onClick={() => handleForward(chat.id)}
                      avatar={chat.avatar}
                      name={chat.name}
                      type="группа"
                    />
                  ))}
                </>
              )}

              {/* Каналы */}
              {filteredChannels.length > 0 && (
                <>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pt-2 pb-1 px-1 font-medium">
                    📢 Каналы
                  </div>
                  {filteredChannels.map(channel => (
                    <ChatButton
                      key={channel.id}
                      chat={channel}
                      onClick={() => handleForward(`channel_${channel.id}`)}
                      avatar={channel.avatar}
                      name={channel.name}
                      type="канал"
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Кнопка отмены */}
        <div className="flex justify-end mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// Вспомогательный компонент для кнопки чата
function ChatButton({ chat, onClick, avatar, name, type }) {
  const isImageAvatar = avatar && typeof avatar === 'string' && avatar.startsWith('/uploads/');
  const avatarUrl = isImageAvatar ? getAvatarUrl(avatar) : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition flex items-center gap-3 text-sm border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/30"
    >
      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
        {isImageAvatar ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg">{avatar || '👤'}</span>
        )}
      </div>
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{name}</span>
      <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">{type}</span>
    </button>
  );
}