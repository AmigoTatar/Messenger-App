import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { API_BASE_URL, isNativeApp } from '../../config';
import { useMessage } from '../../contexts/MessageContext';

export default function MessageInput({
  activeChatId,
  socketRef,
  isChannelReadOnly = false,
  currentUserId,
  activeChatData,
  apiBaseUrl = API_BASE_URL,
  replyingTo,
  setReplyingTo,
  showToast = () => {},
}) {
  const { sendMessage } = useMessage();
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTypingEmitted, setIsTypingEmitted] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const useNativeRecorderRef = useRef(false);
  const discardRecordingRef = useRef(false);
  const [showEmojis, setShowEmojis] = useState(false);

  const QUICK_EMOJIS = ['😀', '😂', '😍', '😘', '😎', '😭', '👍', '❤️', '🔥', '🎉', '👏', '🙏'];

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const uploadAudioBlob = async (blob, filename = 'voice.webm', mime = 'audio/webm') => {
    const file = new File([blob], filename, { type: mime });
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    const response = await fetch(`${apiBaseUrl}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) throw new Error('Ошибка загрузки аудио');
    const data = await response.json();
    const fileUrl = data.fileUrl.startsWith('http')
      ? data.fileUrl
      : `${apiBaseUrl}${data.fileUrl}`;
    sendMessage(null, fileUrl, 'audio');
  };

  const base64ToBlob = (base64, mime) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;

    if (replyingTo) {
      if (socketRef) {
        socketRef.emit('create_thread', {
          messageId: replyingTo.messageId,
          text: text,
          activeChatId: activeChatId,
        });
        setReplyingTo(null);
      }
    } else {
      sendMessage(text, null, null);
    }
    setInputValue('');

    if (socketRef) {
      socketRef.emit('stop_typing', { activeChatId });
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    e.target.style.height = '40px';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

    if (socketRef && !isTypingEmitted && activeChatData?.type !== 'channel') {
      setIsTypingEmitted(true);
      console.log('📤 Отправляю typing для чата:', activeChatId);
      socketRef.emit('typing', { activeChatId });
      setTimeout(() => {
        setIsTypingEmitted(false);
        if (socketRef) socketRef.emit('stop_typing', { activeChatId });
      }, 1500);
    }
  };

  const [uploading, setUploading] = useState(false);

  const uploadImageFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      let details = '';
      try {
        const errBody = await response.json();
        details = errBody.details || errBody.error || '';
      } catch (_) {}
      throw new Error(details || `Ошибка загрузки (${response.status})`);
    }
    const data = await response.json();
    return data.fileUrl.startsWith('http')
      ? data.fileUrl
      : `${apiBaseUrl}${data.fileUrl}`;
  };

  const handleFileChange = async (e) => {
    const picked = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (picked.length === 0) {
      showToast('Пожалуйста, выберите изображение');
      return;
    }
    if (picked.length > 5) {
      showToast('Можно отправить не больше 5 фото за раз', 'info');
    }
    const files = picked.slice(0, 5);
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          showToast(`${file.name}: максимум 20 МБ`, 'error');
          continue;
        }
        const fileUrl = await uploadImageFile(file);
        sendMessage(null, fileUrl, 'image');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Не удалось отправить изображение');
    } finally {
      setUploading(false);
    }
  };

  const startRecordingWeb = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'Микрофон недоступен в этом контексте (нужен HTTPS или нативная запись)'
      );
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
    mediaRecorderRef.current = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    audioChunksRef.current = [];
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    mediaRecorderRef.current.onstop = async () => {
      try {
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          audioChunksRef.current = [];
          return;
        }
        const type = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        const ext = type.includes('mp4') ? 'm4a' : 'webm';
        await uploadAudioBlob(blob, `voice.${ext}`, type);
      } catch (err) {
        console.error(err);
        showToast('Не удалось отправить аудио');
      } finally {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    mediaRecorderRef.current.start();
  };

  const startRecordingNative = async () => {
    const can = await VoiceRecorder.canDeviceVoiceRecord();
    if (!can.value) {
      throw new Error('Устройство не поддерживает запись звука');
    }
    const perm = await VoiceRecorder.requestAudioRecordingPermission();
    if (!perm.value) {
      throw new Error('Нет разрешения на микрофон');
    }
    await VoiceRecorder.startRecording();
  };

  const startRecording = async () => {
    try {
      discardRecordingRef.current = false;
      // Live-reload по http://IP — mediaDevices нет; на APK используем нативный плагин
      useNativeRecorderRef.current =
        isNativeApp || Capacitor.isNativePlatform();

      if (useNativeRecorderRef.current) {
        await startRecordingNative();
      } else {
        await startRecordingWeb();
      }
      setIsRecording(true);
    } catch (err) {
      console.error('startRecording:', err);
      showToast('Микрофон недоступен: ' + (err?.message || String(err)));
      setIsRecording(false);
    }
  };

  const stopStreamTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);

    try {
      if (useNativeRecorderRef.current) {
        const result = await VoiceRecorder.stopRecording();
        const mime = result.value?.mimeType || 'audio/aac';
        const b64 = result.value?.recordDataBase64;
        if (!b64) throw new Error('Пустая запись');
        const blob = base64ToBlob(b64, mime);
        const ext =
          mime.includes('mp4') || mime.includes('aac') || mime.includes('m4a')
            ? 'm4a'
            : 'webm';
        await uploadAudioBlob(blob, `voice.${ext}`, mime);
      } else if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    } catch (err) {
      console.error('stopRecording:', err);
      showToast('Не удалось отправить аудио: ' + (err?.message || String(err)));
    }
  };

  const cancelRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    discardRecordingRef.current = true;
    try {
      if (useNativeRecorderRef.current) {
        try {
          await VoiceRecorder.stopRecording();
        } catch {
          /* запись могла уже остановиться */
        }
      } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch (err) {
      console.warn('cancelRecording:', err);
    } finally {
      audioChunksRef.current = [];
      stopStreamTracks();
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  if (isChannelReadOnly) {
    return (
      <div className="p-5 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-center text-sm font-medium tracking-wide text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-2 select-none">
        📢 Только администраторы могут оставлять сообщения
      </div>
    );
  }

  return (
    <>
      {replyingTo && (
        <div className="w-full flex items-center justify-between p-2 bg-zinc-100 dark:bg-zinc-800 rounded-t-xl border-b border-zinc-200 dark:border-zinc-700">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[80%]">
            Ответ на:{' '}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {replyingTo.text}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="text-xs text-zinc-400 hover:text-red-400 transition"
          >
            ✕
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2 shrink-0"
      >
        {showEmojis && !isRecording && (
          <div className="flex flex-wrap gap-1 px-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setInputValue((prev) => prev + emoji)}
                className="text-lg p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-center">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          multiple
          className="hidden"
        />

        {!isRecording && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2 text-zinc-400 hover:text-emerald-500 rounded-xl transition active:scale-95 disabled:opacity-50"
              title="Прикрепить фото"
            >
              {uploading ? (
                <span className="inline-block w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                '📎'
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowEmojis((v) => !v)}
              className={`p-2 rounded-xl transition active:scale-95 ${
                showEmojis ? 'text-emerald-500' : 'text-zinc-400 hover:text-emerald-500'
              }`}
              title="Смайлы"
            >
              😊
            </button>
          </>
        )}

        {isRecording ? (
          <div className="flex-1 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl px-4 py-2.5 text-sm flex items-center justify-between font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span>Запись...</span>
            </div>
            <span>{formatTime(recordingTime)}</span>
          </div>
        ) : (
          <textarea
            value={inputValue}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
                e.target.style.height = '40px';
              }
            }}
            placeholder="Напишите сообщение..."
            autoComplete="off"
            rows={1}
            className="flex-1 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 resize-none min-h-[40px] max-h-[120px] no-scrollbar py-2"
          />
        )}

        {isRecording ? (
          <>
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2.5 rounded-xl text-sm font-medium transition active:scale-95 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-red-500"
              title="Отменить запись"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="p-2.5 rounded-xl text-sm font-medium transition active:scale-95 shadow-md bg-emerald-600 text-white hover:bg-emerald-500"
              title="Отправить голосовое"
            >
              ➤
            </button>
          </>
        ) : inputValue.trim() === '' ? (
          <button
            type="button"
            onClick={startRecording}
            className="p-2.5 rounded-xl text-sm font-medium transition active:scale-95 shadow-md flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400"
            title="Голосовое сообщение"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition active:scale-95 shadow-md shadow-emerald-900/20"
          >
            Отправить
          </button>
        )}
        </div>
      </form>
    </>
  );
}
