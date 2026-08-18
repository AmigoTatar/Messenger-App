
import { useState, useCallback, useRef } from 'react';
import { apiClient } from '../services/apiClient';
import { getChatIdFromMessage } from '../utils/chatUtils';

export function useMessages(currentUserId) {
    const [messagesByChat, setMessagesByChat] = useState({});
    const [hasMore, setHasMore] = useState({});
    const [loading, setLoading] = useState({});
    const loadingRef = useRef({});

    const getMessages = useCallback((chatId) => {
        return messagesByChat[chatId] || [];
    }, [messagesByChat]);

    // Вспомогательная функция сортировки
    const sortMessages = (msgs) => {
        return [...msgs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    };

   const addMessage = useCallback((chatId, message) => {
    console.log(' [addMessage] Вызвана для chatId:', chatId, 'message:', message);
    setMessagesByChat(prev => {
        const current = prev[chatId] || [];
        console.log(' [addMessage] Текущие сообщения в', chatId, ':', current.length);
        
        if (current.some(m => m.id === message.id)) {
            console.log(' [addMessage] Сообщение уже есть, пропускаю');
            return prev;
        }
        
        const updated = [...current, message];
        console.log(' [addMessage] Новое количество:', updated.length);
        return { ...prev, [chatId]: updated };
    });
}, []);

    const addMessages = useCallback((chatId, newMessages, prepend = false) => {
        setMessagesByChat(prev => {
            const current = prev[chatId] || [];
            const existingIds = new Set(current.map(m => m.id));
            const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
            if (uniqueNew.length === 0) return prev;

            // Объединяем и сортируем
            const combined = prepend ? [...uniqueNew, ...current] : [...current, ...uniqueNew];
            const sorted = sortMessages(combined);
            return { ...prev, [chatId]: sorted };
        });
    }, []);

    const loadHistory = useCallback(async (chatId, cursorMessageId = null) => {
        if (loadingRef.current[chatId]) return;
        loadingRef.current[chatId] = true;
        setLoading(prev => ({ ...prev, [chatId]: true }));

        try {
            let url = `/api/messages?activeChatId=${chatId}`;
            if (cursorMessageId) {
                url += `&cursorMessageId=${cursorMessageId}`;
            }
            const data = await apiClient(url);
            const rawMessages = Array.isArray(data) ? data : (data.messages || data || []);
            if (rawMessages.length > 0) {
                addMessages(chatId, rawMessages, !!cursorMessageId);
            }
            setHasMore(prev => ({ ...prev, [chatId]: data.hasMore || false }));
        } catch (err) {
            const msg = err?.message || '';
            if (/не участник|нет доступа|запрещен|Forbidden/i.test(msg) && !/токен/i.test(msg)) {
                window.dispatchEvent(new CustomEvent('potok-chat-forbidden', { detail: { chatId, message: msg } }));
            }
            console.error('Error loading history:', err);
        } finally {
            loadingRef.current[chatId] = false;
            setLoading(prev => ({ ...prev, [chatId]: false }));
        }
    }, [addMessages]);

    const markMessageAsRead = useCallback((chatId, messageId) => {
        setMessagesByChat(prev => {
            const updated = (prev[chatId] || []).map(m =>
                m.id === messageId ? { ...m, status: 'read' } : m
            );
            return { ...prev, [chatId]: updated };
        });
    }, []);

    const deleteMessageLocally = useCallback((chatId, messageId) => {
        setMessagesByChat(prev => {
            const updated = (prev[chatId] || []).map(m =>
                m.id === messageId ?
                { ...m, isDeleted: true, text: 'Сообщение удалено', mediaUrl: null, mediaType: null, reactions: [], threads: [] } :
                m
            );
            return { ...prev, [chatId]: updated };
        });
    }, []);

    const clearMessages = useCallback(() => {
        setMessagesByChat({});
        setHasMore({});
        setLoading({});
        loadingRef.current = {};
    }, []);

    return {
        getMessages,
        addMessage,
        addMessages,
        loadHistory,
        hasMore: (chatId) => hasMore[chatId] || false,
        loading: (chatId) => loading[chatId] || false,
        markMessageAsRead,
        setMessagesByChat,
        deleteMessageLocally,
        clearMessages,
    };
}