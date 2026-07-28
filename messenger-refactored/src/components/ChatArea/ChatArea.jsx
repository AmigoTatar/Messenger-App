import React, { useState, useEffect, useCallback } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ContextMenu from './ContextMenu';
import ForwardModal from './ForwardModal';
import EditModal from './EditModal';
import { useMarkAsRead } from '../../hooks/useMarkAsRead';
import { API_BASE_URL } from '../../config';

export default function ChatArea({ 
  activeChatId, 
  activeChat, 
  setActiveChatId, 
  inputValue, 
  setInputValue, 
  onSendMessage, 
  messagesEndRef,
  isTyping,
  onDeleteMessage,
  onSendImage,
  onToggleProfile,
  onSendAudio,
  activeChatData,
  messages,
  setMessages, 
  currentUserId,
  socketRef,
  isSocketConnected,
  typingUser,
  onLoadMoreHistory,
  hasMoreHistory,
  apiBaseUrl = API_BASE_URL,
  isHistoryLoading,
  onMarkAsRead,
  chatsProp,        
  groupChatsProp,   
  onSelectChat,
  channelsProp,
  onPinMessage, 
}) {
  // ==============================================
  // 🧠 СОСТОЯНИЯ ДЛЯ UI
  // ==============================================
  
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    message: null,
  });

  const [forwardModal, setForwardModal] = useState({
    visible: false,
    message: null,
  });

  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [localTypingUser, setLocalTypingUser] = useState(null);


  

  // ==============================================
  // 🎯 ОБРАБОТЧИКИ ДЛЯ КОНТЕКСТНОГО МЕНЮ
  // ==============================================

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleEdit = (msg) => {
    setEditingMessage(msg);
  };

  const handleReply = (msg) => {
    setReplyingTo({ messageId: msg.id, text: msg.text || 'Сообщение' });
  };

  const handleForward = (msg) => {
    setForwardModal({ visible: true, message: msg });
  };
const handleForwardSend = (targetChatId, msg) => {
  console.log('📤 Пересылка в чат:', targetChatId, 'Сообщение:', msg);
  // Проверяем, если целевой чат — канал, то проверяем права
  if (targetChatId.startsWith('channel_')) {
    const channelId = parseInt(targetChatId.replace('channel_', ''), 10);
    const channel = channelsProp?.find(c => c.id === channelId);
    // Проверяем, что пользователь — админ или создатель
    const isAdmin = channel?.creatorId === currentUserId || 
                    channel?.members?.some(m => m.userId === currentUserId && m.role === 'admin');
    if (!isAdmin) {
      alert('❌ Только администраторы могут отправлять сообщения в канал');
      return;
    }
  }
  
  if (socketRef) {
    socketRef.emit('send_message', {
      text: msg.text || '📤 Пересланное сообщение',
      mediaUrl: msg.mediaUrl || null,
      mediaType: msg.mediaType || null,
      activeChatId: targetChatId,
      isForwarded: true,
    });
    console.log('✅ Переслано через сокет');
    if (typeof onSelectChat === 'function') {
      onSelectChat(targetChatId);
    } else {
      console.warn('onSelectChat не передан');
    }
  } else {
    console.error('socketRef отсутствует');
  }
  setForwardModal({ visible: false, message: null });
};

  const handlePin = async (messageId) => {
  console.log('📌 Закрепление:', messageId);
  const id = typeof messageId === 'object' ? messageId.id : messageId;
  
  // ✅ Проверка прав на клиенте
  const msg = messages.find(m => m.id === id);
  if (!msg) return;
  
  // Автор всегда может закрепить
  if (msg.senderId !== currentUserId) {
    // Для каналов: проверяем админа или создателя
    if (activeChatData?.type === 'channel') {
      const isAdmin = activeChatData?.members?.some(m => m.userId === currentUserId && m.role === 'admin');
      const isCreator = activeChatData?.creatorId === currentUserId;
      if (!isAdmin && !isCreator) {
        alert('❌ Вы не можете закрепить это сообщение');
        return;
      }
    } else if (activeChatData?.type === 'group') {
      if (activeChatData?.creatorId !== currentUserId) {
        alert('❌ Только создатель группы может закреплять сообщения');
        return;
      }
    } else {
      // Приватный чат: только автор
      alert('❌ Вы можете закреплять только свои сообщения');
      return;
    }
  }
  
  if (onPinMessage) {
    try {
      await onPinMessage(id);
      await fetchPinnedMessages();
    } catch (error) {
      console.error('Ошибка закрепления:', error);
      // Не вызываем повторно
    }
  }
};
// ==============================================
  const handleDelete = (messageId) => {
    if (onDeleteMessage) onDeleteMessage(messageId);
  };

// ==============================================
// 📌 ЗАКРЕПЛЁННЫЕ СООБЩЕНИЯ
// ==============================================
const [pinnedMessages, setPinnedMessages] = useState([]);
const [showPinnedList, setShowPinnedList] = useState(false);
const [pinnedLoading, setPinnedLoading] = useState(false);

const fetchPinnedMessages = useCallback(async () => {
  if (!activeChatId) return;
  setPinnedLoading(true);
  try {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    
    if (activeChatId.startsWith('channel_')) {
      params.append('channelId', activeChatId.replace('channel_', ''));
    } else if (activeChatId.startsWith('chat_')) {
      params.append('chatId', activeChatId.replace('chat_', ''));
    } else if (activeChatId.startsWith('user_')) {
      // ✅ Для приватных чатов передаём ID собеседника
      const otherUserId = activeChatId.replace('user_', '');
      params.append('privateUserId', otherUserId);
    } else {
      setPinnedMessages([]);
      setPinnedLoading(false);
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/messages/pinned?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      setPinnedMessages(data);
    }
  } catch (error) {
    console.error('Ошибка загрузки закреплённых:', error);
  } finally {
    setPinnedLoading(false);
  }
}, [activeChatId]);
// ==============================================
// 📝 СТАТУС "ПЕЧАТАЕТ..."
// ==============================================
useEffect(() => {
  if (!socketRef) {
    console.log('⚠️ socket отсутствует, подписка на typing не выполнена');
    return;
  }

  const handleTyping = (data) => {
    console.log('📝 handleTyping получен:', data);
    if (Number(data.senderId) === Number(currentUserId)) return;
    if (data.activeChatId !== activeChatId) return;
    setLocalTypingUser(data);
  };

  const handleStopTyping = (data) => {
    console.log('📝 handleStopTyping получен:', data);
    if (data.activeChatId !== activeChatId) return;
    setLocalTypingUser(null);
  };

  socketRef.on('typing', handleTyping);
  socketRef.on('stop_typing', handleStopTyping);

  return () => {
    socketRef.off('typing', handleTyping);
    socketRef.off('stop_typing', handleStopTyping);
  };
}, [socketRef, currentUserId, activeChatId, socketRef?.connected]); 


// ==============================================
// 🎯 ОБРАБОТЧИКИ ДЛЯ КОНТЕКСТНОГО МЕНЮ (исправленные)
// ==============================================

const handleReaction = async (messageId, emoji) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: emoji }),
    });
    if (!response.ok) {
      if (response.status === 429) {
        alert('❌ Слишком много реакций, подождите');
        return;
      }
      // Пытаемся прочитать ошибку
      let errorMsg = 'Ошибка реакции';
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        const text = await response.text();
        errorMsg = text || errorMsg;
      }
      throw new Error(errorMsg);
    }
    const data = await response.json();
    if (setMessages && activeChatId) {
      setMessages(prev => {
        const newState = { ...prev };
        const chatMessages = newState[activeChatId] || [];
        newState[activeChatId] = chatMessages.map(m =>
          m.id === messageId ? { ...m, reactions: data.reactions || [] } : m
        );
        return newState;
      });
    }
  } catch (error) {
    console.error('Ошибка реакции:', error);
    // Не показываем alert, если это просто 404 или что-то подобное
    if (!error.message.includes('404')) {
      alert('Не удалось поставить реакцию: ' + error.message);
    }
  }
};

const handleEditSave = async (messageId, newText) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: newText }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка редактирования');
    }
    const data = await response.json();
    console.log('✅ Редактирование успешно, ответ сервера:', data);
    // Обновляем локальный стейт
    if (setMessages && activeChatId) {
      setMessages(prev => {
        const newState = { ...prev };
        const chatMessages = newState[activeChatId] || [];
        newState[activeChatId] = chatMessages.map(m =>
          m.id === messageId ? { ...m, text: data.message.text, edited: true } : m
        );
        return newState;
      });
      setEditingMessage(null);
    }
    // НЕТ АЛЕРТА ЗДЕСЬ
  } catch (error) {
    console.error('❌ Ошибка редактирования:', error);
    /* alert('Не удалось отредактировать сообщение: ' + error.message); // если алерт здесь, он сработает только при ошибке */
  }
};



useEffect(() => {
  fetchPinnedMessages();
}, [activeChatId, fetchPinnedMessages]);



useEffect(() => {
  if (!socketRef) return;
  const handleMessagePinned = (data) => {
    // Обновляем список закреплённых при событии
    fetchPinnedMessages();
    // Также обновляем локальные сообщения, чтобы показать иконку 📌
    setMessages(prev => {
  const newState = { ...prev };
  const chatMessages = newState[activeChatId] || [];
  newState[activeChatId] = chatMessages.map(msg =>
    msg.id === data.messageId ? { ...msg, isPinned: data.isPinned } : msg
  );
  return newState;
});
  };
  socketRef.on('message_pinned', handleMessagePinned);
  return () => {
    socketRef.off('message_pinned', handleMessagePinned);
  };
}, [socketRef, fetchPinnedMessages, setMessages]);

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, message: null });
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      message: msg,
    });
  };

  
// Проверка, можно ли писать в канал (только админы и создатель)
const isReadOnly = activeChatData?.type === 'channel' && (
  activeChatData?.creatorId !== Number(currentUserId) &&
  !(activeChatData?.members || []).some(m => m.userId === Number(currentUserId) && m.role === 'admin')
);
const isTypingVisible = localTypingUser !== null && activeChatData?.type !== 'channel';

console.log('🔍 isReadOnly:', isReadOnly, 'activeChatData:', activeChatData);


const canPin = (msg) => {
  if (!msg) return false;
  if (msg.senderId === currentUserId) return true;
  if (activeChatData?.type === 'channel') {
    const isAdmin = activeChatData?.members?.some(m => m.userId === currentUserId && m.role === 'admin');
    if (isAdmin) return true;
    if (activeChatData?.creatorId === currentUserId) return true;
  }
  if (activeChatData?.type === 'group' && activeChatData?.creatorId === currentUserId) return true;
  return false;
};

  // Заглушки для недостающих функций
  
  const handleMarkAsRead = () => {};
  const handleReactionToggle = () => {};
  const handleThreadReply = () => {};
  
  const getChatName = () => {
  if (!activeChatId) return 'Выберите чат';
  if (activeChatId === 'chat_general') return 'Общий чат';
  if (activeChatData?.name) return activeChatData.name;
  if (activeChatId.startsWith('channel_')) {
    const ch = channelsProp?.find(c => `channel_${c.id}` === activeChatId);
    return ch?.name || 'Канал';
  }
  if (activeChatId.startsWith('chat_')) {
    const gr = groupChatsProp?.find(c => c.id === activeChatId);
    return gr?.name || 'Групповой чат';
  }
  if (activeChatId.startsWith('user_')) {
    const pr = chatsProp?.find(c => c.id === activeChatId);
    return pr?.name || 'Пользователь';
  }
  return 'Чат';
};

console.log('📊 [ChatArea] received messages:', messages);
console.log('📊 [ChatArea] messages length:', messages?.length);
  return (
  <div className="flex-col flex-1 h-full bg-zinc-100 dark:bg-zinc-900">
    {!activeChatId ? (
  <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-4 text-center bg-white dark:bg-zinc-900">
  <span className="text-4xl mb-2">💬</span>
  <p className="text-sm">Выберите чат, чтобы начать общение</p>
</div>
) : (
      // ✅ Добавляем обёртку flex flex-col h-full
      <div className="flex flex-col h-full">
        <ChatHeader
          chatName={getChatName()}
          chatAvatar={activeChatData?.avatar}
          chatType={activeChatData?.type}
          isOnline={activeChatData?.isOnline}
          isTyping={isTypingVisible}
          isDataLoading={!activeChatData && activeChatId !== 'chat_general'}
          pinnedCount={pinnedMessages?.length || 0}
          onTogglePinned={() => setShowPinnedList(!showPinnedList)}
          onToggleProfile={onToggleProfile}
          onBack={() => setActiveChatId(null)}
        />

        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          activeChatId={activeChatId}
          onLoadMore={onLoadMoreHistory}
          hasMore={hasMoreHistory}
          loading={isHistoryLoading}
          onMarkAsRead={handleMarkAsRead}
          onContextMenu={handleContextMenu}
          onReactionToggle={handleReactionToggle}
          onThreadReply={handleThreadReply}
          onForward={handleForward}
          onEdit={handleEdit}
          onPin={handlePin}
          onDelete={handleDelete}
          socketRef={socketRef}
        />
{showPinnedList && (
  <div className="mx-4 my-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
    <div className="p-3 border-b border-amber-200 dark:border-amber-800/30 flex justify-between items-center">
      <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
        <span>📌</span> Закрепленные сообщения ({pinnedMessages.length})
      </h4>
      <button
        onClick={() => setShowPinnedList(false)}
        className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition"
      >
        ✕
      </button>
    </div>
    <div className="p-2">
      {pinnedLoading ? (
        <div className="text-center py-4 text-zinc-500 dark:text-zinc-400">Загрузка...</div>
      ) : pinnedMessages.length === 0 ? (
        <div className="text-center py-4 text-sm text-zinc-400 dark:text-zinc-500">
          Нет закрепленных сообщений
        </div>
      ) : (
        pinnedMessages.map(msg => (
          <div
            key={msg.id}
            className="p-3 bg-white dark:bg-zinc-900 rounded-lg mb-2 border border-amber-200/50 dark:border-amber-800/20 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 cursor-pointer transition"
            onClick={() => {
              const element = document.querySelector(`[data-message-id="${msg.id}"]`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight-animation');
                setTimeout(() => element.classList.remove('highlight-animation'), 2000);
              }
              setShowPinnedList(false);
            }}
          >


            <div className="flex items-start gap-2">
              <span className="text-amber-500 dark:text-amber-400 text-sm mt-0.5">📌</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {msg.sender?.username || 'Unknown'}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                  {msg.text || '📎 Медиафайл'}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
)}
        <MessageInput
  activeChatId={activeChatId}
  socketRef={socketRef}
  isChannelReadOnly={isReadOnly}
  currentUserId={currentUserId}
  activeChatData={activeChatData}
  apiBaseUrl={apiBaseUrl}
  replyingTo={replyingTo}
  setReplyingTo={setReplyingTo}
/>

        {/* Контекстное меню */}
        {contextMenu.visible && (
          <ContextMenu
            message={contextMenu.message}
            currentUserId={currentUserId}
            onClose={closeContextMenu}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            onCopy={handleCopy}
            onEdit={handleEdit}
            onReply={handleReply}
            onForward={handleForward}
            onPin={handlePin}
            onDelete={handleDelete}
            onReaction={handleReaction}
            canDelete={
              Number(contextMenu.message?.senderId) === Number(currentUserId) ||
              (activeChatData?.type === 'channel' && activeChatData?.creatorId === Number(currentUserId)) ||
              (activeChatData?.type === 'group' && activeChatData?.creatorId === Number(currentUserId))
            }
          />
        )}

        {/* Модалка пересылки */}
        {forwardModal.visible && (
          <ForwardModal
            visible={forwardModal.visible}
            onClose={() => setForwardModal({ visible: false, message: null })}
            message={forwardModal.message}
            chats={chatsProp}
            groupChats={groupChatsProp}
            channels={channelsProp}
            onForward={handleForwardSend}
            currentUserId={currentUserId}
          />
        )}

        {/* Модалка редактирования */}
        {editingMessage && (
          <EditModal
            message={editingMessage}
            onSave={handleEditSave} 
            onClose={() => setEditingMessage(null)}
          />
        )}
      </div>
    )}
  </div>
);
}