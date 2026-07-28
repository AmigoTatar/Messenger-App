export const getChatIdFromMessage = (msg, currentUserId) => {
    console.log('🔍 getChatIdFromMessage:', msg);
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