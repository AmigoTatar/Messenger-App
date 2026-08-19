import React, { useState } from 'react';
import ChatListItem from './ChatListItem';

function ContactRows({
  contacts,
  contactsVersion,
  activeChatId,
  unreadCounts,
  onSelectChat,
  formatMsgTime,
  onlineUserIds,
  onAction,
  showConfirm,
  confirmTitle,
  confirmMessage,
  confirmText,
  menuLabel,
  menuDanger,
  currentUserId,
}) {
  return contacts.map((contact) => {
    const chatId = `user_${contact.id}`;
    const unreadCount = unreadCounts[chatId] || 0;
    return (
      <ChatListItem
        key={`${contact.id}-${contactsVersion}-${contact.avatar}-${contact.lastMessage?.id || ''}-${contact.hidden ? 'h' : 'v'}`}
        id={chatId}
        name={contact.username}
        avatar={contact.avatar}
        lastMessage={contact.lastMessage || null}
        unreadCount={unreadCount}
        isActive={chatId === activeChatId}
        isOnline={onlineUserIds instanceof Set ? onlineUserIds.has(Number(contact.id)) : false}
        isMuted={contact.muted}
        onClick={() => onSelectChat(chatId)}
        onDelete={
          onAction
            ? () => {
                const run = () => onAction(contact.id);
                if (showConfirm) {
                  showConfirm(confirmTitle, confirmMessage(contact.username), confirmText, run);
                } else {
                  run();
                }
              }
            : undefined
        }
        menuLabel={menuLabel}
        menuDanger={menuDanger}
        formatMsgTime={formatMsgTime}
        type="private"
        currentUserId={currentUserId}
      />
    );
  });
}

export default function ContactList({
  contacts,
  contactsVersion,
  activeChatId,
  unreadCounts,
  onSelectChat,
  formatMsgTime,
  onlineUserIds,
  onRemoveContact,
  onUnhideContact,
  showConfirm,
  currentUserId,
}) {
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const visible = (contacts || []).filter((c) => !c.hidden);
  const hidden = (contacts || []).filter((c) => c.hidden);

  if (visible.length === 0 && hidden.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
        Нет контактов. Добавьте пользователей через поиск.
      </div>
    );
  }

  return (
    <>
      <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
        <span>👤 Контакты</span>
        <span className="text-[9px] text-zinc-500">({visible.length})</span>
      </div>
      {visible.length === 0 ? (
        <div className="px-3 py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Список пуст. Скрытые — ниже.
        </div>
      ) : (
        <ContactRows
          contacts={visible}
          contactsVersion={contactsVersion}
          activeChatId={activeChatId}
          unreadCounts={unreadCounts}
          onSelectChat={onSelectChat}
          formatMsgTime={formatMsgTime}
          onlineUserIds={onlineUserIds}
          onAction={onRemoveContact}
          showConfirm={showConfirm}
          confirmTitle="Скрыть контакт"
          confirmMessage={(name) => `${name} перейдёт в «Скрытые». Переписка и уведомления сохранятся.`}
          confirmText="Скрыть"
          menuLabel="Скрыть контакт"
          menuDanger
          currentUserId={currentUserId}
        />
      )}
      {hidden.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setHiddenOpen((v) => !v)}
            className="w-full px-3 pt-2 pb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2"
          >
            <span>{hiddenOpen ? '▾' : '▸'} Скрытые</span>
            <span className="text-[9px] text-zinc-500">({hidden.length})</span>
          </button>
          {hiddenOpen && (
            <ContactRows
              contacts={hidden}
              contactsVersion={contactsVersion}
              activeChatId={activeChatId}
              unreadCounts={unreadCounts}
              onSelectChat={onSelectChat}
              formatMsgTime={formatMsgTime}
              onlineUserIds={onlineUserIds}
              onAction={onUnhideContact}
              showConfirm={null}
              confirmTitle=""
              confirmMessage={() => ''}
              confirmText=""
          menuLabel="Вернуть в контакты"
          menuDanger={false}
          actionLabel="Вернуть"
          currentUserId={currentUserId}
            />
          )}
        </div>
      )}
    </>
  );
}
