import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import LoadingSpinner from '../LoadingSpinner';
import Avatar from '../Avatar';

export default function ChannelSearchModal({ 
    isOpen, 
    onClose, 
    onSelectChannel, 
    currentUserId,
    showToast 
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [joinLoading, setJoinLoading] = useState(null);
    const [joinStatuses, setJoinStatuses] = useState({});
    const [retryTimers, setRetryTimers] = useState({}); // ← НОВОЕ

    //  Таймер обратного отсчёта
    useEffect(() => {
        const interval = setInterval(() => {
            setRetryTimers(prev => {
                const newTimers = {};
                let hasChanges = false;
                for (const [channelId, timeLeft] of Object.entries(prev)) {
                    if (timeLeft > 0) {
                        newTimers[channelId] = timeLeft - 1;
                        hasChanges = true;
                    } else {
                        hasChanges = true;
                    }
                }
                return hasChanges ? newTimers : prev;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Сброс при закрытии
    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setResults([]);
            setSearched(false);
            setLoading(false);
            setJoinStatuses({});
            setRetryTimers({});
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSearch = async () => {
        if (!query.trim() || query.length < 2) return;
        setSearched(true);
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/channels/search?query=${encodeURIComponent(query)}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (!response.ok) throw new Error('Ошибка поиска');
            const data = await response.json();
            setResults(data);
        } catch (err) {
            console.error('Ошибка поиска каналов:', err);
            showToast('Не удалось найти каналы', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRequest = async (channelId) => {
        setJoinLoading(channelId);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/channels/${channelId}/join-request`,
                {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (!response.ok) {
                const error = await response.json();
                
                if (error.status === 'rejected' && error.canRetryAfter) {
                    const seconds = Math.ceil(error.canRetryAfter * 60);
                    setRetryTimers(prev => ({ ...prev, [channelId]: seconds }));
                    showToast(`⏳ Повторно подать можно через ${Math.ceil(seconds / 60)} мин.`, 'info');
                    setJoinStatuses(prev => ({ 
                        ...prev, 
                        [channelId]: 'rejected'
                    }));
                    return;
                }
                
                throw new Error(error.error || 'Ошибка');
            }
            const data = await response.json();
            setJoinStatuses(prev => ({ ...prev, [channelId]: 'pending' }));
            showToast('✅ Заявка отправлена админу на рассмотрение', 'success');
        } catch (err) {
            console.error('Ошибка подачи заявки:', err);
            showToast(err.message || 'Не удалось подать заявку', 'error');
        } finally {
            setJoinLoading(null);
        }
    };

    const handleCancelRequest = async (channelId) => {
        if (!confirm('Отменить заявку?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/channels/${channelId}/join-request`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            if (!response.ok) throw new Error('Ошибка');
            setJoinStatuses(prev => {
                const newState = { ...prev };
                delete newState[channelId];
                return newState;
            });
            showToast('Заявка отменена', 'info');
        } catch (err) {
            console.error('Ошибка отмены заявки:', err);
            showToast('Не удалось отменить заявку', 'error');
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 sheet-safe">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-100 dark:border-zinc-800 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-white">
                        📢 Поиск каналов
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition text-xl leading-none"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Введите название канала..."
                        className="flex-1 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 text-zinc-800 dark:text-white placeholder-zinc-400"
                        autoFocus
                    />
                    <button
                        onClick={handleSearch}
                        disabled={!query.trim() || query.length < 2}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-md"
                    >
                        🔍
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <LoadingSpinner size="md" />
                        </div>
                    ) : (
                        <>
                            {searched && results.length === 0 && (
                                <div className="text-center text-sm text-zinc-400 py-8">
                                    🔍 Каналы не найдены
                                </div>
                            )}

                            {!searched && query.length >= 2 && (
                                <div className="text-center text-sm text-zinc-400 py-8">
                                    💡 Нажмите 🔍 для поиска
                                </div>
                            )}

                            {results.map((channel) => {
                                const status = joinStatuses[channel.id];
                                const isMember = channel.isMember;
                                const isAdmin = channel.isAdmin;
                                const timeLeft = retryTimers[channel.id] || 0;

                                return (
                                    <div
                                        key={channel.id}
                                        className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 hover:border-emerald-500/30 transition"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                              avatar={channel.avatar}
                                              name={channel.name}
                                              type="channel"
                                              size="md"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                                    {channel.name}
                                                </p>
                                                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                                    👥 {channel.memberCount || 0} участников
                                                    {isAdmin && ' • 👑 Админ'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-2">
{/* Вместо старых кнопок */}
{isMember ? (
    <button
        onClick={() => {
            onSelectChannel(`channel_${channel.id}`);
            onClose();
        }}
        className="flex-1 py-2 text-xs font-medium bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5"
    >
        <span>💬</span> Открыть
    </button>
) : status === 'pending' ? (
    <>
        <button
            disabled
            className="flex-1 py-2 text-xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300 rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5"
        >
            <span className="animate-pulse">⏳</span> Заявка отправлена
        </button>
        <button
            onClick={() => handleCancelRequest(channel.id)}
            className="px-3 py-2 text-xs font-medium bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 rounded-xl transition-all duration-200 active:scale-95"
        >
            ✕
        </button>
    </>
) : status === 'approved' ? (
    <button
        onClick={() => {
            onSelectChannel(`channel_${channel.id}`);
            onClose();
        }}
        className="flex-1 py-2 text-xs font-medium bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5"
    >
        <span>✅</span> Принят! Открыть
    </button>
) : status === 'rejected' ? (
    <div className="flex-1">
        {timeLeft > 0 ? (
            <button
                disabled
                className="w-full py-2 text-xs font-medium bg-zinc-100 dark:bg-zinc-800/30 text-zinc-500 dark:text-zinc-400 rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5"
            >
                <span>⏳</span> {formatTime(timeLeft)}
            </button>
        ) : (
            <button
                onClick={() => handleJoinRequest(channel.id)}
                disabled={joinLoading === channel.id}
                className="w-full py-2 text-xs font-medium bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5"
            >
                {joinLoading === channel.id ? (
                    <span className="animate-spin">⏳</span>
                ) : (
                    <span>📩</span>
                )}
                {joinLoading === channel.id ? 'Отправка...' : 'Подать снова'}
            </button>
        )}
    </div>
) : (
    <button
        onClick={() => handleJoinRequest(channel.id)}
        disabled={joinLoading === channel.id}
        className="flex-1 py-2 text-xs font-medium bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5"
    >
        {joinLoading === channel.id ? (
            <span className="animate-spin">⏳</span>
        ) : (
            <span>📩</span>
        )}
        {joinLoading === channel.id ? 'Отправка...' : 'Подать заявку'}
    </button>
)}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}