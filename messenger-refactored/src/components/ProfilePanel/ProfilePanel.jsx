
import React, { useState, useEffect } from 'react';
import Avatar from '../Avatar';
import { apiClient } from '../../services/apiClient';
import { API_BASE_URL } from '../../config';
import LoadingSpinner from '../LoadingSpinner';
import JoinRequestsPanel from './JoinRequestsPanel';
import ConfirmModal from '../ConfirmModal';

export default function ProfilePanel({ 
  activeChat, 
  isOpen,
  onChatUpdate,
  onClose,
  socketRef,
  showToast,
  contacts,
  onMuteChange,
}) {
  console.log('📤 [ProfilePanel] contacts получены:', contacts);
const [activeTab, setActiveTab] = useState('media');
const [members, setMembers] = useState([]);
const [isLoading, setIsLoading] = useState(false);
const [showAddMember, setShowAddMember] = useState(false);
const [allUsers, setAllUsers] = useState([]);
const [selectedUserId, setSelectedUserId] = useState('');
const [isMuted, setIsMuted] = useState(false);
const [isMuteLoading, setIsMuteLoading] = useState(false);
const [isEditing, setIsEditing] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [newName, setNewName] = useState(activeChat?.name || '');
const [newAvatar, setNewAvatar] = useState(activeChat?.avatar || ''); 
const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;
const [avatarFile, setAvatarFile] = useState(null);
const [avatarPreview, setAvatarPreview] = useState(null);
const [editName, setEditName] = useState('');
const [editAvatar, setEditAvatar] = useState('');

const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: null,
    variant: 'danger'
});

  // Вспомогательная функция для извлечения числового ID из строки с префиксом
const getNumericId = (chatId) => {
  if (!chatId) return null;
  const numeric = parseInt(chatId.replace(/\D/g, ''), 10);
  return isNaN(numeric) ? null : numeric;
};

const showConfirm = (title, message, confirmText, onConfirm, variant = 'danger') => {
    setConfirmModal({
        isOpen: true,
        title,
        message,
        confirmText,
        onConfirm: () => {
            onConfirm();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
        },
        variant
    });
};

// Синхронизируем имя в модалке с текущим чатом
useEffect(() => {
  if (activeChat) {
    setNewName(activeChat.name || '');
    setNewAvatar(activeChat.avatar || '');
  }
}, [activeChat?.id, activeChat?.name, activeChat?.avatar]);

useEffect(() => {
  const onHwBack = (e) => {
    if (confirmModal.isOpen) {
      e.preventDefault();
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      return;
    }
    if (isEditing) {
      e.preventDefault();
      setIsEditing(false);
    }
  };
  window.addEventListener('potok-hardware-back', onHwBack);
  return () => window.removeEventListener('potok-hardware-back', onHwBack);
}, [confirmModal.isOpen, isEditing]);


const fetchMembers = async () => {
  //  Если это общий чат — ничего не делаем
  if (!activeChat || activeChat.id === 'chat_general' || activeChat.id === 'general') {
    setIsLoading(false);
    return;
  }

  setIsLoading(true);
  try {
    const token = localStorage.getItem('token');
    const chatId = activeChat.id;
    let endpoint;
    if (chatId.startsWith('channel_')) {
      const id = chatId.replace('channel_', '');
      endpoint = `/api/channels/${id}/members`;
    } else if (chatId.startsWith('chat_')) {
      const id = chatId.replace('chat_', '');
      endpoint = `/api/chats/${id}/members`;
    } else {
      setIsLoading(false);
      return;
    }
    const data = await apiClient(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    setMembers(data);
  } catch (err) {
    console.error('Ошибка загрузки участников:', err);
  } finally {
    setIsLoading(false);
  }
};

 const fetchMuteStatus = async () => {
  if (!activeChat || activeChat.id === 'chat_general' || activeChat.id === 'general') return;
  try {
    const token = localStorage.getItem('token');
    const chatId = activeChat.id;
    const numericId = getNumericId(chatId);
    if (!numericId) return;
    let type;
    if (chatId.startsWith('user_')) type = 'private';
    else if (chatId.startsWith('channel_')) type = 'channel';
    else if (chatId.startsWith('chat_')) type = 'chat';
    else return;
    const data = await apiClient(`/api/mute-status?type=${type}&id=${numericId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setIsMuted(data.muted);
  } catch (err) {
    console.error('Ошибка загрузки mute:', err);
  }
};

  // Загрузка участников и статуса mute
  
  useEffect(() => {
    //  Защита: если профиль закрыт или нет чата или нет id
    if (!isOpen || !activeChat || !activeChat.id) {
      return;
    }

    // Проверяем, что id начинается с корректного префикса
    const chatId = activeChat.id;
    if (!chatId.startsWith('channel_') && !chatId.startsWith('chat_') && !chatId.startsWith('user_')) {
      // Если это общий чат или что-то другое – выходим
      return;
    }

    // Сброс, чтобы не тащить админ-роль с предыдущего канала
    setMembers([]);
    fetchMembers();
    fetchMuteStatus();
  }, [isOpen, activeChat?.id]);

  
  // Загрузка всех пользователей для добавления

  useEffect(() => {
    if (!showAddMember) return;

const fetchUsers = async () => {

    try {
        const token = localStorage.getItem('token');
        const users = await apiClient('/api/users', {
            headers: { Authorization: `Bearer ${token}` },
        });
        console.log('📤 [ProfilePanel] Все пользователи (users):', users);
        console.log('📤 [ProfilePanel] members:', members);
        console.log('📤 [ProfilePanel] contacts:', contacts);

        const memberIds = members.map(m => m.userId);
        const contactIds = contacts.map(c => c.id); 

           console.log('📤 [ProfilePanel] memberIds:', memberIds);
        console.log('📤 [ProfilePanel] contactIds:', contactIds);
        
        const availableUsers = users
            .filter(u => !memberIds.includes(u.dbId || u.id))
            .filter(u => contactIds.includes(u.dbId || u.id));
        
        setAllUsers(availableUsers);
        console.log('📤 [ProfilePanel] users для групп:', users.map(u => ({ id: u.id, dbId: u.dbId, name: u.name })));
console.log('📤 [ProfilePanel] memberIds для групп:', memberIds);
console.log('📤 [ProfilePanel] contactIds для групп:', contactIds);
    } catch (err) {
        console.error('Ошибка загрузки пользователей:', err);
    }
};
    fetchUsers();
  }, [showAddMember, members]);
  

  
  // Переключение "Не беспокоить"
 
  const handleToggleMute = async () => {
  setIsMuteLoading(true);
  try {
    const token = localStorage.getItem('token');
    const chatId = activeChat.id;
    const numericId = getNumericId(chatId);
    if (!numericId) return;
    let type;
    if (chatId.startsWith('user_')) type = 'private';
    else if (chatId.startsWith('channel_')) type = 'channel';
    else if (chatId.startsWith('chat_')) type = 'chat';
    else return;
    const data = await apiClient(`/api/mute`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, id: numericId }),
    });
    setIsMuted(data.muted);
    onMuteChange?.(chatId, data.muted);
  } catch (err) {
    console.error('Ошибка переключения mute:', err);
  } finally {
    setIsMuteLoading(false);
  }
};

const handleAvatarChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  }
};

const handleSaveChat = async (e) => {
  e.preventDefault();
  setIsSaving(true);
  try {
    const token = localStorage.getItem('token');
    const chatId = activeChat?.id;
    if (!chatId) throw new Error('ID чата не найден');

    const numericId = getNumericId(chatId);
    if (!numericId) throw new Error('Некорректный ID');

    const url = activeChat.type === 'channel'
      ? `${API_BASE_URL}/api/channels/${numericId}`
      : `${API_BASE_URL}/api/chats/${numericId}`;

    const formData = new FormData();
    formData.append('name', newName);
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }

const res = await fetch(url, {
    method: 'PUT',
    headers: {
        'Authorization': `Bearer ${token}`,
    },
    body: formData,
});
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Ошибка обновления');
    }
    const updated = await res.json();
    if (typeof onChatUpdate === 'function') {
      onChatUpdate({ ...updated, type: activeChat.type });
    }
    setIsEditing(false);
    setAvatarFile(null);
    setAvatarPreview(null);
  } catch (err) {
    showToast('Не удалось обновить: ' + err.message);
  } finally {
    setIsSaving(false);
  }
};


  
  // Добавление участника
  
const handleAddMember = async () => {
  if (!selectedUserId) return;
  try {
    const token = localStorage.getItem('token');
    const chatId = activeChat.id;
    const numericId = getNumericId(chatId);
    if (!numericId) return;
    let endpoint;
    if (chatId.startsWith('channel_')) {
      endpoint = `/api/channels/${numericId}/members`;
    } else if (chatId.startsWith('chat_')) {
      endpoint = `/api/chats/${numericId}/members`;
    } else return;
    const newMember = await apiClient(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: parseInt(selectedUserId) }),
    });
    setMembers(prev => [...prev, newMember]);
    setShowAddMember(false);
    setSelectedUserId('');
    if (socketRef?.current) {
      socketRef.current.emit('add_member', {
        chatId: activeChat.id,
        userId: parseInt(selectedUserId),
        chatType: chatId.startsWith('channel_') ? 'channel' : 'group',
      });
    }
  } catch (err) {
    console.error('Ошибка добавления:', err);
  }
};

  // Удаление участника
  
const handleRemoveMember = async (userId, username) => {
    showConfirm(
        'Удалить участника?',
        `Вы уверены, что хотите удалить пользователя "${username}" из чата?`,
        'Удалить',
        async () => {
            try {
                const token = localStorage.getItem('token');
                const chatId = activeChat.id;
                const numericId = getNumericId(chatId);
                if (!numericId) return;
                let endpoint;
                if (chatId.startsWith('channel_')) {
                    endpoint = `/api/channels/${numericId}/members/${userId}`;
                } else if (chatId.startsWith('chat_')) {
                    endpoint = `/api/chats/${numericId}/members/${userId}`;
                } else return;
                await apiClient(endpoint, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
                setMembers(prev => prev.filter(m => m.userId !== userId));
                if (socketRef?.current) {
                    socketRef.current.emit('remove_member', {
                        chatId: activeChat.id,
                        userId,
                        chatType: chatId.startsWith('channel_') ? 'channel' : 'group',
                    });
                }
                showToast(`✅ Пользователь удалён из чата`, 'success');
            } catch (err) {
                console.error('Ошибка удаления:', err);
                showToast('❌ Не удалось удалить участника', 'error');
            }
        }
    );
};
// Покинуть группу
const handleLeaveGroup = async () => {
    showConfirm(
        'Покинуть группу?',
        'Вы уверены, что хотите покинуть группу? Вы потеряете доступ к чату.',
        'Покинуть',
        async () => {
            try {
                const token = localStorage.getItem('token');
                const chatId = activeChat.id;
                const numericId = getNumericId(chatId);
                if (!numericId) return;
                await apiClient(`/api/chats/${numericId}/members/${currentUserId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
                onClose();
            } catch (err) {
                console.error('Ошибка выхода из группы:', err);
                showToast('❌ Не удалось покинуть группу', 'error');
            }
        }
    );
};
// Покинуть канал
const handleLeaveChannel = async () => {
    showConfirm(
        'Покинуть канал?',
        'Вы уверены, что хотите покинуть канал? Вы потеряете доступ к нему.',
        'Покинуть',
        async () => {
            try {
                const token = localStorage.getItem('token');
                const chatId = activeChat.id;
                const numericId = getNumericId(chatId);
                if (!numericId) return;
                await apiClient(`/api/channels/${numericId}/members/${currentUserId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
                onClose();
            } catch (err) {
                console.error('Ошибка выхода из канала:', err);
                showToast('❌ Не удалось покинуть канал', 'error');
            }
        }
    );
};
  
  // Удаление чата/канала
  
const handleDeleteChat = async () => {
    const chatId = activeChat.id;
    const type = chatId.startsWith('channel_') ? 'канал' : 'групповой чат';
    showConfirm(
        `Удалить ${type}?`,
        `Вы уверены, что хотите удалить ${type} "${activeChat.name}"? Это действие необратимо!`,
        'Удалить',
        async () => {
            try {
                const token = localStorage.getItem('token');
                const numericId = getNumericId(chatId);
                if (!numericId) return;
                let endpoint;
                if (chatId.startsWith('channel_')) {
                    endpoint = `/api/channels/${numericId}`;
                } else if (chatId.startsWith('chat_')) {
                    endpoint = `/api/chats/${numericId}`;
                } else return;
                await apiClient(endpoint, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
                onClose();
                showToast(`✅ ${type} удалён`, 'success');
            } catch (err) {
                console.error('Ошибка удаления:', err);
                showToast(`❌ Не удалось удалить ${type}`, 'error');
            }
        },
        'danger'
    );
};

  // Рендер 
  
  if (!isOpen || !activeChat) return null;

  const messages = activeChat.messages || [];
  const mediaImages = messages.filter(m => m.mediaType === 'image' && !m.isDeleted);
  const audioFiles = messages.filter(m => m.mediaType === 'audio' && !m.isDeleted);

 const isAdmin = activeChat.type === 'channel'
  ? (
      Number(activeChat.creatorId) === Number(currentUserId) ||
      members.some(m => Number(m.userId) === Number(currentUserId) && m.role === 'admin')
    )
  : Number(activeChat.creatorId) === Number(currentUserId);

  const isCreator = Number(activeChat.creatorId) === Number(currentUserId);

  console.log(' ProfilePanel: activeChat.creatorId=', activeChat?.creatorId, 'currentUserId=', currentUserId, 'isCreator=', isCreator)







const openEditModal = () => {
  setNewName(activeChat.name || '');
  setNewAvatar(activeChat.avatar || '');
  setIsEditing(true);
};


  return (
    <div className="w-full sm:w-80 h-full border-l flex flex-col animate-fade-in fixed right-0 top-0 bottom-0 z-50 md:relative md:z-0 md:inset-auto shadow-2xl md:shadow-none bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-[calc(env(safe-area-inset-bottom,0px)+40px)] md:pt-0 md:pb-0">
      <div className="p-4 border-b flex items-center justify-between border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-950/40">
        <h3 className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">Информация</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg transition text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-6 no-scrollbar text-zinc-800 dark:text-zinc-200">
        
        <div className="flex flex-col items-center text-center space-y-3">
  <Avatar
    avatar={activeChat.avatar}
    name={activeChat.name}
    type={activeChat.type === 'channel' ? 'channel' : activeChat.type === 'group' ? 'group' : 'private'}
    size="2xl"
    className="shadow-lg border-2 border-zinc-300/50 dark:border-zinc-700/50 text-5xl"
  />
  <div className="flex items-center gap-2">
    <h2 className="font-bold text-lg text-zinc-900 dark:text-white">
        {activeChat.name}
    </h2>
    {activeChat?.type !== 'private' && (
        <button
            onClick={openEditModal}
            className="text-sm text-emerald-400 hover:text-emerald-300 transition"
            title="Редактировать"
        >
            ✏️
        </button>
    )}
</div>
  <span className="text-xs text-zinc-500 dark:text-zinc-400">
    {activeChat.type === 'channel' ? '📢 Канал' :
     activeChat.type === 'group' ? '👥 Групповой чат' : '💬 Чат'}
  </span>
</div>

        

        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Кнопка выхода из группы для обычных участников */}
{activeChat.type === 'group' && !isCreator && (
<button
    onClick={handleLeaveGroup}
    className="w-full py-2 px-4 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
>
    <span>🚪</span> Покинуть группу
</button>
)}
{/* Кнопка выхода из канала для обычных участников */}
{activeChat.type === 'channel' && !isCreator && (
  <button
    onClick={handleLeaveChannel}
    className="w-full py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
  >
    <span>🚪</span> Покинуть канал
  </button>
)}

        {(activeChat.id?.startsWith('channel_') || activeChat.id?.startsWith('chat_')) && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Участники ({members.length})</h4>
              {isAdmin && (
                <button
    onClick={() => setShowAddMember(!showAddMember)}
    className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
>
    {showAddMember ? '✕ Отмена' : '+ Добавить'}
</button>
              )}
            </div>

            
              {console.log('📤 [ProfilePanel] allUsers для рендера:', allUsers)}
            {showAddMember && (
              <div className="mb-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900">
                <div className="max-h-48 overflow-y-auto space-y-1 mb-2">
                  {allUsers.map(user => (
                    <label key={user.id} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800">
                      <input
                        type="radio"
                        name="selectedUser"
                        value={user.dbId || user.id}
                        checked={selectedUserId === String(user.dbId || user.id)}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-4 h-4 text-emerald-600"
                      />
                      <span>{user.name || user.username}</span>
                    </label>
                  ))}
                </div>
<button
    onClick={handleAddMember}
    disabled={!selectedUserId}
    className="w-full bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium py-2 rounded-lg transition-colors"
>
    Добавить
</button>
              </div>
            )}

            {isLoading ? (
              <LoadingSpinner size="md" />
            ) : (
              members.map(member => {
                const user = member.user || {};
                return (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-100/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition">
                    <div className="flex items-center gap-3">
                      <Avatar avatar={user.avatar} name={user.username} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {user.username || 'Неизвестный'}
                          {member.userId === currentUserId && <span className="ml-1.5 text-[10px] text-emerald-400 dark:text-emerald-500">(Вы)</span>}
                        </p>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">
                          {member.role === 'admin' ? '👑 Админ' : '👤 Участник'}
                        </span>
                      </div>
                    </div>
                    {isAdmin && member.role !== 'admin' && member.userId !== currentUserId && (
                      <button 
    onClick={() => handleRemoveMember(member.userId, user.username)} 
    className="text-xs text-red-400 hover:text-red-300 transition"
>
    Удалить
</button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <button
          onClick={handleToggleMute}
          disabled={isMuteLoading}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 bg-zinc-800/30 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-300 disabled:opacity-50"
        >
          <span>{isMuted ? '🔕' : '🔔'}</span>
          {isMuted ? 'Включить уведомления' : 'Отключить уведомления'}
          {isMuteLoading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ml-1"></span>}
        </button>

        <hr className="border-zinc-200 dark:border-zinc-800" />

      {(activeChat.type === 'channel' || activeChat.type === 'group') && isCreator && (
    <button
        onClick={handleDeleteChat}
        className="w-full py-2 px-4 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
    >
        <span>🗑️</span> Удалить {activeChat.type === 'channel' ? 'канал' : 'групповой чат'}
    </button>
)}



        <hr className="border-zinc-200 dark:border-zinc-800" />

        <div className="flex border-b text-xs border-zinc-200 dark:border-zinc-800">
          <button onClick={() => setActiveTab('media')} className={`flex-1 pb-2.5 font-semibold uppercase tracking-wider transition-colors ${activeTab === 'media' ? 'border-b border-zinc-800 dark:border-white text-zinc-800 dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}>
            Медиа ({mediaImages.length})
          </button>
          <button onClick={() => setActiveTab('audio')} className={`flex-1 pb-2.5 font-semibold uppercase tracking-wider transition-colors ${activeTab === 'audio' ? 'border-b border-zinc-800 dark:border-white text-zinc-800 dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}>
            Аудио ({audioFiles.length})
          </button>
        </div>

        <div className="pt-2">
          {activeTab === 'media' && (
            mediaImages.length === 0 ? (
              <p className="text-xs italic text-center py-4 rounded-xl border border-dashed text-zinc-400 dark:text-zinc-500 bg-zinc-100/20 dark:bg-zinc-900/20 border-zinc-300/40 dark:border-zinc-800/40">Нет отправленных изображений</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {mediaImages.map(msg => (
                  <div key={msg.id} className="aspect-square rounded-lg overflow-hidden border bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800">
                    <img src={msg.mediaUrl} alt="Shared" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )
          )}
          {activeTab === 'audio' && (
            audioFiles.length === 0 ? (
              <p className="text-xs italic text-center py-4 rounded-xl border border-dashed text-zinc-400 dark:text-zinc-500 bg-zinc-100/20 dark:bg-zinc-900/20 border-zinc-300/40 dark:border-zinc-800/40">Нет отправленных аудиосообщений</p>
            ) : (
              <div className="space-y-2">
                {audioFiles.map(msg => (
                  <div key={msg.id} className="p-2.5 border rounded-xl flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800">
                    <div className="text-xl">🎙️</div>
                    <audio src={msg.mediaUrl} controls className="w-full h-6" />
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
      {isEditing && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-zinc-100 dark:border-zinc-800">
      <h3 className="text-lg font-bold text-zinc-800 dark:text-white mb-4">
        Редактировать {activeChat.type === 'channel' ? 'канал' : 'группу'}
      </h3>
      <form onSubmit={handleSaveChat} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Название
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white"
            placeholder="Новое название"
            required
            autoFocus
          />
        </div>
        
        <div>
  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
    Аватар (загрузите изображение)
  </label>
  <input
    type="file"
    accept="image/*"
    onChange={handleAvatarChange}
    className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-zinc-800 dark:file:text-emerald-400"
  />
  {avatarPreview && (
    <div className="mt-2 flex justify-center">
      <img src={avatarPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500" />
    </div>
  )}
</div>
        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
            }}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isSaving || !newName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-md"
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

 {/* Заявки на вступление (только для админов) */}
      {activeChat?.type === 'channel' && isAdmin && (
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <JoinRequestsPanel
            channelId={getNumericId(activeChat.id)}
            currentUserId={currentUserId}
            showToast={showToast}
            socketRef={socketRef}
            onRequestHandled={() => {
              fetchMembers();
            }}
          />
        </div>
      )}

      {/* ✅ ConfirmModal ВНЕ всех условий */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.variant}
      />

    </div>
  );
}