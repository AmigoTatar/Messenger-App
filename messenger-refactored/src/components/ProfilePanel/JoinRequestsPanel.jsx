import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import { getAvatarUrl } from '../../utils/avatarUtils';
import LoadingSpinner from '../LoadingSpinner';

export default function JoinRequestsPanel({ channelId, currentUserId, showToast, onRequestHandled }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null);

    const fetchRequests = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/channels/${channelId}/join-requests`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (!response.ok) throw new Error('Ошибка загрузки заявок');
            const data = await response.json();
            setRequests(data);
        } catch (err) {
            console.error('Ошибка загрузки заявок:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [channelId]);

    const handleApprove = async (requestId) => {
        setProcessing(requestId);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/channels/join-requests/${requestId}/approve`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            if (!response.ok) throw new Error('Ошибка одобрения');
            
            showToast('✅ Пользователь принят в канал!', 'success');
            setRequests(prev => prev.filter(r => r.id !== requestId));
            if (onRequestHandled) onRequestHandled();
        } catch (err) {
            console.error('Ошибка одобрения:', err);
            showToast('❌ Не удалось одобрить заявку', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (requestId) => {
        setProcessing(requestId);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_BASE_URL}/api/channels/join-requests/${requestId}/reject`,
                
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            if (!response.ok) throw new Error('Ошибка отклонения');
            
            showToast('❌ Заявка отклонена', 'info');
            setRequests(prev => prev.filter(r => r.id !== requestId));
            if (onRequestHandled) onRequestHandled();
        } catch (err) {
            console.error('Ошибка отклонения:', err);
            showToast('❌ Не удалось отклонить заявку', 'error');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="py-4">
                <LoadingSpinner size="sm" />
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="py-2 text-xs text-zinc-400 dark:text-zinc-500 text-center">
                Нет новых заявок
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2">
                <span>📩 Заявки на вступление</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                    {requests.length}
                </span>
            </div>
            {requests.map((req) => (
                <div
                    key={req.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-700/50"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-sm">
                            {req.user?.avatar?.startsWith('/uploads/') ? (
                                <img src={getAvatarUrl(req.user.avatar)} alt={req.user.username} className="w-full h-full object-cover" />
                            ) : (
                                <span>{req.user?.avatar || '👤'}</span>
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                {req.user?.username || 'Неизвестный'}
                            </p>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                {new Date(req.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>


   <div className="flex gap-1.5">
    <button
        onClick={() => handleApprove(req.id)}
        disabled={processing === req.id}
        className="px-3 py-1.5 text-xs font-medium bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-1 disabled:opacity-50"
    >
        {processing === req.id ? (
            <span className="animate-spin">⏳</span>
        ) : (
            <span>✅</span>
        )}
        Принять
    </button>
    <button
        onClick={() => handleReject(req.id)}
        disabled={processing === req.id}
        className="px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-1 disabled:opacity-50"
    >
        {processing === req.id ? (
            <span className="animate-spin">⏳</span>
        ) : (
            <span>❌</span>
        )}
        Отклонить
    </button>
</div>

                </div>
            ))}
        </div>
    );
}