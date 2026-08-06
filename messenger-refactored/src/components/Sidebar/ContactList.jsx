import React from 'react';
import ChatListItem from './ChatListItem';

export default function ContactList({ contacts, contactsVersion, activeChatId, unreadCounts, onSelectChat, formatMsgTime }) {
 console.log(' ContactList: contacts for render:', JSON.stringify(contacts.map(c => ({ 
    id: c.id, 
    name: c.username, 
    lastMessage: c.lastMessage 
})), null, 2));
  if (!contacts || contacts.length === 0) {
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
                <span className="text-[9px] text-zinc-500">({contacts.length})</span>
            </div>
            {contacts.map((contact) => {
                const chatId = `user_${contact.id}`;
                const unreadCount = unreadCounts[chatId] || 0;
                return (
                    <ChatListItem
                         key={`${contact.id}-${contactsVersion}-${contact.avatar}-${contact.lastMessage?.id || ''}`}
                        id={chatId}
                        name={contact.username}
                        avatar={contact.avatar}
                        lastMessage={contact.lastMessage || null}
                        unreadCount={unreadCount}
                        isActive={chatId === activeChatId}
                        onClick={() => onSelectChat(chatId)}
                        formatMsgTime={formatMsgTime}
                        type="private"
                    />
                );
            })}
        </>
    );
}