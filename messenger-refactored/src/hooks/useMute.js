// src/hooks/useMute.js
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

export function useMute(activeChat) {
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchMuteStatus = useCallback(async () => {
    if (!activeChat) return;
    const { type, id } = getChatTypeAndId(activeChat);
    if (!type || !id) return;
    try {
      const data = await apiClient(`/api/mute-status?type=${type}&id=${id}`);
      setIsMuted(data.muted || false);
    } catch (err) {
      console.error('Error fetching mute status:', err);
    }
  }, [activeChat]);

  useEffect(() => {
    fetchMuteStatus();
  }, [fetchMuteStatus]);

  const toggleMute = useCallback(async () => {
    if (!activeChat) return;
    const { type, id } = getChatTypeAndId(activeChat);
    if (!type || !id) return;
    setLoading(true);
    try {
      const data = await apiClient('/api/mute', {
        method: 'POST',
        body: JSON.stringify({ type, id }),
      });
      setIsMuted(data.muted);
    } catch (err) {
      console.error('Error toggling mute:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeChat]);

  return { isMuted, loading, toggleMute, refetch: fetchMuteStatus };
}

// Вспомогательная функция
function getChatTypeAndId(chat) {
  if (!chat || !chat.id) return { type: null, id: null };
  const id = chat.id;
  if (id.startsWith('channel_')) return { type: 'channel', id: id.replace('channel_', '') };
  if (id.startsWith('chat_')) return { type: 'chat', id: id.replace('chat_', '') };
  if (id.startsWith('user_')) return { type: 'private', id: id.replace('user_', '') };
  return { type: null, id: null };
}