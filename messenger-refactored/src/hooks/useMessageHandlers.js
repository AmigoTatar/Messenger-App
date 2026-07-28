// hooks/useMessageHandlers.js
import { useCallback } from 'react';

export function useMessageHandlers({
    setMessagesByChat,
    setChats,
    setChannels,
    setGroupChats,
    setChatsVersion,
    setChannelsVersion,
    setGroupChatsVersion,
    setActiveChatId,
    setActiveChatData,
    setIsProfileOpen,
    user,
    setUser,
    activeChatData,
    activeChatIdRef,
    updateUnread,
    joinChat,
    loadHistory,
    reloadChats,
    processedEvents
}) {

    // ==============================================
    // 🎯 ОБРАБОТЧИК ОБНОВЛЕНИЯ РЕАКЦИЙ
    // ==============================================
    const handleReactionUpdated = useCallback(({ messageId, reactions }) => {
        setMessagesByChat(prev => {
            const newState = { ...prev };
            for (const chatId in newState) {
                newState[chatId] = newState[chatId].map(msg =>
                    msg.id === messageId ? { ...msg, reactions } : msg
                );
            }
            return newState;
        });
    }, [setMessagesByChat]);

    // ==============================================
    // 🎯 ОБРАБОТЧИК НОВОГО КОММЕНТАРИЯ (ТРЕДА)
    // ==============================================
    const handleThreadCreated = useCallback(({ thread, messageId }) => {
        setMessagesByChat(prev => {
            const newState = { ...prev };
            for (const chatId in newState) {
                newState[chatId] = newState[chatId].map(msg =>
                    msg.id === messageId
                        ? { ...msg, threads: [...(msg.threads || []), thread] }
                        : msg
                );
            }
            return newState;
        });
    }, [setMessagesByChat]);

    // ==============================================
    // 🎯 ОБРАБОТЧИК РЕДАКТИРОВАНИЯ СООБЩЕНИЯ
    // ==============================================
    const handleMessageEdited = useCallback(({ messageId, text }) => {
        setMessagesByChat(prev => {
            const newState = { ...prev };
            for (const chatId in newState) {
                newState[chatId] = newState[chatId].map(msg =>
                    msg.id === messageId ? { ...msg, text, edited: true } : msg
                );
            }
            return newState;
        });
    }, [setMessagesByChat]);

// ==============================================
// 🎯 ОБРАБОТЧИК УДАЛЕНИЯ СООБЩЕНИЯ (ФИНАЛЬНАЯ ВЕРСИЯ)
// ==============================================
const handleMessageDeleted = useCallback(({ messageId, activeChatId }) => {
    console.log('🔥 [handleMessageDeleted] messageId:', messageId, 'activeChatId:', activeChatId);

    if (!activeChatId) {
        console.log('❌ [handleMessageDeleted] Нет activeChatId');
        return;
    }

    let newLastMessage = null;

    // ✅ 1. Обновляем ВСЕ сообщения во ВСЕХ чатах
    setMessagesByChat(prev => {
        const newState = { ...prev };
        for (const chatId in newState) {
            newState[chatId] = newState[chatId].map(msg =>
                msg.id === messageId
                    ? { ...msg, isDeleted: true, text: 'Сообщение удалено', mediaUrl: null, mediaType: null, reactions: [], threads: [] }
                    : msg
            );
        }
        // Находим последнее НЕудалённое сообщение для activeChatId
        if (newState[activeChatId]) {
            const lastValid = newState[activeChatId]
                .filter(msg => !msg.isDeleted)
                .pop();
            newLastMessage = lastValid || null;
        }
        return newState;
    });

    // 2. Заглушка для сайдбара
    if (newLastMessage === null) {
        newLastMessage = {
            id: messageId,
            isDeleted: true,
            text: 'Сообщение удалено',
            mediaUrl: null,
            mediaType: null,
            createdAt: new Date().toISOString(),
            sender: { id: null, username: 'Unknown' }
        };
    }

    // 3. Обновляем lastMessage в сайдбаре
    if (activeChatId.startsWith('channel_')) {
        setChannels(prev => prev.map(ch => {
            if (`channel_${ch.id}` === activeChatId) {
                return { ...ch, lastMessage: newLastMessage };
            }
            return ch;
        }));
        setChannelsVersion(prev => prev + 1);
    } else if (activeChatId.startsWith('chat_')) {
        setGroupChats(prev => prev.map(ch => {
            if (ch.id === activeChatId) {
                return { ...ch, lastMessage: newLastMessage };
            }
            return ch;
        }));
        setGroupChatsVersion(prev => prev + 1);
        console.log('✅ lastMessage обновлён для группы', activeChatId, 'новое:', newLastMessage);
    } else if (activeChatId.startsWith('user_')) {
        // Принудительно перезагружаем список приватных чатов
        if (reloadChats) {
            reloadChats();
            console.log('📊 [handleMessageDeleted] Перезагружаю список приватных чатов');
        }
        const chatUserId = parseInt(activeChatId.replace('user_', ''), 10);
        setChats(prev => prev.map(ch => {
            const chUserId = parseInt(ch.id?.replace('user_', ''), 10);
            if (chUserId === chatUserId) {
                return { ...ch, lastMessage: newLastMessage };
            }
            return ch;
        }));
        setChatsVersion(prev => prev + 1);
        console.log('✅ lastMessage обновлён для приватного чата', activeChatId, 'новое:', newLastMessage);
    }
}, [setMessagesByChat, setChats, setChannels, setGroupChats, setChatsVersion, setChannelsVersion, setGroupChatsVersion, reloadChats]);    // 🎯 ОБРАБОТЧИК ОБНОВЛЕНИЯ ПОЛЬЗОВАТЕЛЯ
    // ==============================================



    const handleUserUpdated = useCallback((data) => {
        const { userId, username, avatar } = data;
        console.log('🔄 [user_updated] Получено:', data);

        if (userId === user?.id) {
            const updatedUser = { ...user, username, avatar };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }

        setChats(prev => prev.map(ch => {
            if (ch.dbId === userId) {
                return { ...ch, name: username, avatar: avatar || ch.avatar };
            }
            return ch;
        }));

        setGroupChats(prev => prev.map(chat => ({
            ...chat,
            members: chat.members?.map(m => {
                if (m.userId === userId) {
                    return { ...m, user: { ...m.user, username, avatar } };
                }
                return m;
            })
        })));

        setChannels(prev => prev.map(channel => ({
            ...channel,
            members: channel.members?.map(m => {
                if (m.userId === userId) {
                    return { ...m, user: { ...m.user, username, avatar } };
                }
                return m;
            })
        })));

        if (activeChatData && activeChatData.type === 'private' && activeChatData.dbId === userId) {
            setActiveChatData(prev => ({
                ...prev,
                name: username,
                avatar: avatar || prev.avatar
            }));
        }

        setChatsVersion(prev => prev + 1);
        setGroupChatsVersion(prev => prev + 1);
        setChannelsVersion(prev => prev + 1);
    }, [user, setUser, setChats, setGroupChats, setChannels, activeChatData, setActiveChatData, setChatsVersion, setGroupChatsVersion, setChannelsVersion]);

    // ==============================================
    // 🎯 ОБРАБОТЧИК УДАЛЕНИЯ ИЗ КАНАЛА
    // ==============================================
    const handleKickedFromChannel = useCallback(({ channelId }) => {
        console.log(`👢 Вас удалили из канала ${channelId}`);
        setChannels(prev => prev.filter(ch => ch.id !== channelId));
        if (activeChatIdRef?.current === `channel_${channelId}`) {
            setActiveChatId('chat_general');
            setActiveChatData({ name: 'Общий чат', avatar: '💬', type: 'general' });
            setMessagesByChat(prev => {
                const newState = { ...prev };
                delete newState[`channel_${channelId}`];
                return newState;
            });
        }
    }, [setChannels, setActiveChatId, setActiveChatData, setMessagesByChat, activeChatIdRef]);

    // ==============================================
    // 🎯 ОБРАБОТЧИК ЗАКРЕПЛЕНИЯ СООБЩЕНИЯ
    // ==============================================
    const handleMessagePinned = useCallback(({ messageId, isPinned }) => {
        setMessagesByChat(prev => {
            const newState = { ...prev };
            for (const chatId in newState) {
                newState[chatId] = newState[chatId].map(msg =>
                    msg.id === messageId ? { ...msg, isPinned } : msg
                );
            }
            return newState;
        });
    }, [setMessagesByChat]);

    // ==============================================
    // 🎯 ОБРАБОТЧИК ОБНОВЛЕНИЯ НЕПРОЧИТАННЫХ
    // ==============================================
    const handleUnreadUpdated = useCallback((data) => {
        const { type, id, count } = data;
        let chatKey;
        if (type === 'channel') chatKey = `channel_${id}`;
        else if (type === 'chat') chatKey = `chat_${id}`;
        else if (type === 'private') chatKey = `user_${id}`;

        const currentActive = activeChatIdRef?.current;
        console.log('📊 [handleUnreadUpdated] chatKey:', chatKey, 'active:', currentActive, 'count:', count);

        if (chatKey === currentActive && currentActive !== null) {
            console.log('🔄 Сбрасываю unread для активного чата:', chatKey);
            updateUnread(chatKey, 0);
        } else {
            updateUnread(chatKey, count);
        }
    }, [updateUnread, activeChatIdRef]);

    // ==============================================
    // 🎯 ОБРАБОТЧИК СТАТУСА ПРОЧТЕНИЯ
    // ==============================================
    const handleMessagesReadUpdate = useCallback(({ activeChatId: readChatId, readerId }) => {
        if (Number(readerId) === Number(user?.id)) return;
        console.log('📖 [handleMessagesReadUpdate] Чат:', readChatId, 'Прочитал:', readerId);

        setMessagesByChat(prev => {
            const newState = { ...prev };
            for (const chatId in newState) {
                if (chatId === readChatId) {
                    newState[chatId] = newState[chatId].map(msg => {
                        if (Number(msg.senderId) === Number(user?.id)) {
                            return { ...msg, status: 'read' };
                        }
                        return msg;
                    });
                    break;
                }
            }
            return newState;
        });
    }, [setMessagesByChat, user]);

    return {
        handleReactionUpdated,
        handleThreadCreated,
        handleMessageEdited,
        handleMessageDeleted,
        handleUserUpdated,
        handleKickedFromChannel,
        handleMessagePinned,
        handleUnreadUpdated,
        handleMessagesReadUpdate
    };
}