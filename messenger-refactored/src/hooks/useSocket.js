import { useEffect, useRef, useCallback, useState } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config';

export function useSocket(user, eventHandlers) {
    const socketRef = useRef(null);
    const handlersRef = useRef(eventHandlers);
    const roomsRef = useRef(new Set());
    // React-state: иначе socketRef.current при первом рендере = null
    // и подписки в App useEffect не перевешиваются после connect
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        handlersRef.current = eventHandlers;
    }, [eventHandlers]);

    useEffect(() => {
        if (!user) {
            setSocket(null);
            setIsConnected(false);
            return undefined;
        }
        const token = localStorage.getItem('token');
        if (!token) return undefined;

        const s = io(API_BASE_URL, {
            // polling первым: Android WebView часто рвёт wss (ERR_CONNECTION_ABORTED)
            transports: ['polling', 'websocket'],
            upgrade: true,
            auth: { token },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 8000,
            timeout: 20000,
            forceNew: false,
        });

        socketRef.current = s;
        setSocket(s);

        const handlers = handlersRef.current;
        if (handlers) {
            Object.entries(handlers).forEach(([event, handler]) => {
                s.on(event, handler);
            });
        }

        s.on('connect', () => {
            console.log('✅ Socket connected via', s.io.engine?.transport?.name);
            setIsConnected(true);
            roomsRef.current.forEach((room) => {
                s.emit('join_chat', room);
                console.log('🔁 Повторная подписка на комнату:', room);
            });
            if (user?.id) {
                s.emit('join_chat', `user_${user.id}`);
            }
        });

        s.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected:', reason);
            setIsConnected(false);
        });

        s.on('reconnect_attempt', (attempt) => {
            console.log(`🔄 Попытка переподключения #${attempt}`);
        });

        s.on('reconnect', () => {
            console.log('✅ Socket переподключился');
            setIsConnected(true);
        });

        s.on('connect_error', (err) => {
            console.warn('⚠️ Socket connect_error:', err?.message || err);
        });

        const addRoom = (room) => {
            if (room && !roomsRef.current.has(room)) {
                roomsRef.current.add(room);
                if (socketRef.current?.connected) {
                    socketRef.current.emit('join_chat', room);
                }
            }
        };
        s.addRoom = addRoom;

        const onVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            const sock = socketRef.current;
            if (!sock) return;
            if (!sock.connected) {
                sock.connect();
                return;
            }
            roomsRef.current.forEach((room) => {
                sock.emit('join_chat', room);
            });
            if (user?.id) {
                sock.emit('join_chat', `user_${user.id}`);
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            if (handlers) {
                Object.keys(handlers).forEach((event) => {
                    s.off(event);
                });
            }
            s.off('connect');
            s.off('disconnect');
            s.off('reconnect_attempt');
            s.off('reconnect');
            s.off('connect_error');
            s.disconnect();
            socketRef.current = null;
            roomsRef.current.clear();
            setSocket(null);
            setIsConnected(false);
        };
    }, [user?.id]);

    const emit = useCallback((event, data) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(event, data);
        } else {
            console.warn('⚠️ emit: сокет не подключён', event);
        }
    }, []);

    const joinChat = useCallback((chatId) => {
        if (!chatId) return;
        // Уже в комнате — не шлём join_chat повторно (анти-шторм при обновлении сайдбара)
        if (roomsRef.current.has(chatId)) return;
        roomsRef.current.add(chatId);
        if (socketRef.current?.connected) {
            socketRef.current.emit('join_chat', chatId);
            console.log('📡 joinChat:', chatId);
        } else {
            console.log('⏳ joinChat отложен до connect:', chatId);
        }
    }, []);

    const sendMessage = useCallback((messageData, onAck) => {
        if (!socketRef.current?.connected) {
            if (typeof onAck === 'function') onAck({ ok: false, error: 'Нет соединения' });
            return;
        }
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            if (typeof onAck === 'function') onAck({ ok: false, error: 'Не удалось отправить' });
        }, 12000);
        socketRef.current.emit('send_message', messageData, (res) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (typeof onAck === 'function') onAck(res || { ok: true });
        });
    }, []);

    return { socket, emit, joinChat, sendMessage, isConnected };
}
