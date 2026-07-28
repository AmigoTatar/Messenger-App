// hooks/useSocket.js
import { useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config';

export function useSocket(user, eventHandlers) {
    const socketRef = useRef(null);
    const handlersRef = useRef(eventHandlers);
    const roomsRef = useRef(new Set()); // храним комнаты, в которые подписались

    useEffect(() => {
        handlersRef.current = eventHandlers;
    }, [eventHandlers]);

    useEffect(() => {
        if (!user) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        const socket = io(API_BASE_URL, {
            transports: ['websocket'],
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });
        socketRef.current = socket;

        // Подписываемся на события из handlersRef
        const handlers = handlersRef.current;
        if (handlers) {
            Object.entries(handlers).forEach(([event, handler]) => {
                socket.on(event, handler);
            });
        }

        // Базовые события
        socket.on('connect', () => {
            console.log('✅ Socket connected');
            // ✅ После переподключения заново подписываемся на все комнаты
            roomsRef.current.forEach(room => {
                socket.emit('join_chat', room);
                console.log('🔄 Повторная подписка на комнату:', room);
            });
            // Подписываемся на свой приватный чат
            if (user?.id) {
                socket.emit('join_chat', `user_${user.id}`);
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
        });

        socket.on('reconnect_attempt', (attempt) => {
            console.log(`🔄 Попытка переподключения #${attempt}`);
        });

        socket.on('reconnect', () => {
            console.log('✅ Socket переподключился');
        });

        // Функция для добавления комнаты
        const addRoom = (room) => {
            if (room && !roomsRef.current.has(room)) {
                roomsRef.current.add(room);
                if (socketRef.current) {
                    socketRef.current.emit('join_chat', room);
                }
            }
        };

        // Сохраняем функцию в ref, чтобы использовать в других хуках
        socketRef.current.addRoom = addRoom;

        return () => {
            if (handlers) {
                Object.keys(handlers).forEach((event) => {
                    socket.off(event);
                });
            }
            socket.off('connect');
            socket.off('disconnect');
            socket.off('reconnect_attempt');
            socket.off('reconnect');
            socket.offAny();
            socket.disconnect();
            socketRef.current = null;
            roomsRef.current.clear();
        };
    }, [user]);

    const emit = useCallback((event, data) => {
        if (socketRef.current) {
            socketRef.current.emit(event, data);
        }
    }, []);

    const joinChat = useCallback((chatId) => {
        console.log('📡 [joinChat] Вызвана для', chatId);
        if (!socketRef.current) {
            console.warn('⚠️ joinChat: сокет отсутствует');
            return;
        }
        // Добавляем комнату в ref и подписываемся
        if (chatId && !roomsRef.current.has(chatId)) {
            roomsRef.current.add(chatId);
            socketRef.current.emit('join_chat', chatId);
            console.log('📡 joinChat: подписка на', chatId);
        }
    }, []);

    const sendMessage = useCallback((messageData) => {
        if (socketRef.current) {
            socketRef.current.emit('send_message', messageData);
        }
    }, []);

    return { socket: socketRef.current, emit, joinChat, sendMessage };
}