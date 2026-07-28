// src/components/ProfilePanel/MemberList.jsx
import React, { useState } from 'react';
import MemberItem from './MemberItem';

export default function MemberList({
  members,
  loading,
  currentUserId,
  isAdmin,
  onAddMember,
  onRemoveMember,
  allUsers,
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  const handleAdd = () => {
    if (selectedUserId) {
      onAddMember(selectedUserId);
      setSelectedUserId('');
      setShowAdd(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Участники ({members.length})
        </h4>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} className="text-xs text-emerald-400 hover:text-emerald-300 transition">
            {showAdd ? '✕ Отмена' : '+ Добавить'}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900">
          <div className="max-h-48 overflow-y-auto space-y-1 mb-2">
            {allUsers.map((user) => (
              <label key={user.id} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition hover:bg-zinc-200 dark:hover:bg-zinc-800">
                <input type="radio" name="selectedUser" value={user.id} checked={selectedUserId === String(user.id)} onChange={() => setSelectedUserId(String(user.id))} />
                <span>{user.name || user.username}</span>
              </label>
            ))}
          </div>
          <button onClick={handleAdd} disabled={!selectedUserId} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition">
            Добавить участника
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-4 text-sm text-zinc-400">Загрузка...</div>
      ) : members.length === 0 ? (
        <div className="text-center py-4 text-sm text-zinc-400">Нет участников</div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <MemberItem
              key={member.id}
              member={member}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onRemove={() => onRemoveMember(member.userId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}