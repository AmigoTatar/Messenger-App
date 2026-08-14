export const getChatIdFromMessage = (msg, currentUserId) => {
    console.log(' getChatIdFromMessage:', msg);
    if (!msg) return 'chat_general';

    // === КАНАЛЫ ===
    if (msg.channelId) {
        const channelId = String(msg.channelId);
        return channelId.startsWith('channel_') ? channelId : `channel_${channelId}`;
    }

    // === ГРУППОВЫЕ ЧАТЫ ===
    if (msg.chatId) {
        const chatId = String(msg.chatId);
        // Если уже есть префикс chat_ — оставляем
        if (chatId.startsWith('chat_')) {
            return chatId;
        }
        // Если это число или ID без префикса — добавляем
        return `chat_${chatId}`;
    }

    // === ПРИВАТНЫЕ ЧАТЫ ===
    if (msg.receiverId && msg.senderId) {
        const senderId = Number(msg.senderId);
        const receiverId = Number(msg.receiverId);
        const myId = Number(currentUserId);
        return senderId === myId ? `user_${receiverId}` : `user_${senderId}`;
    }

    // === ОБЩИЙ ЧАТ (если ничего не подошло) ===
    return 'chat_general';
};

export const getChatType = (chatId) => {
    if (!chatId) return null;
    if (chatId === 'chat_general') return 'general';
    if (chatId.startsWith('channel_')) return 'channel';
    if (chatId.startsWith('user_')) return 'private';
    if (chatId.startsWith('chat_')) return 'group';
    return null;
};

export const extractIdFromChatId = (chatId) => {
    if (!chatId) return null;
    const parts = chatId.split('_');
    return parts.length > 1 ? parts[1] : null;
};
// Извлекает числовой ID из строки с префиксом (channel_, chat_, user_)
export const extractNumericId = (id) => {
    if (!id) return null;
    const raw = String(id);
    const numeric = parseInt(raw.replace(/^channel_/, '').replace(/^chat_/, '').replace(/^user_/, ''), 10);
    return isNaN(numeric) ? null : numeric;
};

// Получает данные активного чата по ID
export const getActiveChatData = (chatId, channels, groupChats, chats, contacts = []) => {
    if (!chatId) return null;

    if (chatId.startsWith('channel_')) {
        const ch = channels?.find(c => `channel_${c.id}` === chatId);
        if (ch) {
            return {
                name: ch.name,
                avatar: ch.avatar,
                type: 'channel',
                creatorId: ch.creatorId,
                members: ch.members || []
            };
        }
    } else if (chatId.startsWith('chat_')) {
        const gr = groupChats?.find(c => c.id === chatId || `chat_${c.dbId}` === chatId);
        if (gr) {
            return {
                name: gr.name,
                avatar: gr.avatar,
                type: 'group',
                creatorId: gr.creatorId,
                members: gr.members || []
            };
        }
    } else if (chatId.startsWith('user_')) {
        const userId = parseInt(chatId.replace('user_', ''), 10);
        const pr = chats?.find(c => c.id === chatId || c.dbId === userId);
        if (pr) {
            return {
                name: pr.name,
                avatar: pr.avatar,
                type: 'private',
                dbId: pr.dbId || userId
            };
        }
        const contact = contacts?.find(c => c.id === userId);
        if (contact) {
            return {
                name: contact.username || contact.name,
                avatar: contact.avatar,
                type: 'private',
                dbId: contact.id
            };
        }
    }
    return null;
};

// Нормализация ID чата
export const normalizeChatId = (chatId) => {
    if (!chatId) return chatId;
    let normalized = chatId;
    while (normalized.startsWith('chat_chat_') || 
           normalized.startsWith('channel_channel_') || 
           normalized.startsWith('user_user_')) {
        if (normalized.startsWith('chat_chat_')) {
            normalized = normalized.replace('chat_chat_', 'chat_');
        } else if (normalized.startsWith('channel_channel_')) {
            normalized = normalized.replace('channel_channel_', 'channel_');
        } else if (normalized.startsWith('user_user_')) {
            normalized = normalized.replace('user_user_', 'user_');
        }
    }
    return normalized;
};