// src/components/ChatArea/MessageInput.jsx
import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
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

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;

    if (replyingTo) {
      // ✅ Убираем .current
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
    // ✅ Убираем .current
    if (socketRef) {
      socketRef.emit('stop_typing', { activeChatId });
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    e.target.style.height = '40px';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

    // ✅ Убираем .current
    if (socketRef && !isTypingEmitted && activeChatData?.type !== 'channel') {
  setIsTypingEmitted(true);
  console.log('📤 Отправляю typing для чата:', activeChatId);
  socketRef.emit('typing', { activeChatId });
      setTimeout(() => {
        setIsTypingEmitted(false);
        // ✅ Убираем .current
        if (socketRef) socketRef.emit('stop_typing', { activeChatId });
      }, 1500);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBaseUrl}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) throw new Error('Ошибка загрузки');
      const data = await response.json();
      const fileUrl = data.fileUrl.startsWith('http') ? data.fileUrl : `${apiBaseUrl}${data.fileUrl}`;
      sendMessage(null, fileUrl, 'image');
    } catch (err) {
      console.error(err);
      alert('Не удалось отправить изображение');
    }
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm' };
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', file);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${apiBaseUrl}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
          });
          if (!response.ok) throw new Error('Ошибка загрузки аудио');
          const data = await response.json();
          const fileUrl = data.fileUrl.startsWith('http') ? data.fileUrl : `${apiBaseUrl}${data.fileUrl}`;
          sendMessage(null, fileUrl, 'audio');
        } catch (err) {
          console.error(err);
          alert('Не удалось отправить аудио');
        }
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert('Микрофон недоступен: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
            Ответ на: <span className="font-medium text-zinc-700 dark:text-zinc-300">{replyingTo.text}</span>
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

      <form onSubmit={handleSubmit} className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 items-center">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />
        
        {!isRecording && (
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            className="p-2 text-zinc-400 hover:text-emerald-500 rounded-xl transition active:scale-95"
          >
            📎
          </button>
        )}

        {isRecording ? (
          <div className="flex-1 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl px-4 py-2.5 text-sm flex items-center justify-between font-medium animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span>Запись голосового сообщения...</span>
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

        {inputValue.trim() === '' ? (
          <button 
            type="button" 
            onClick={isRecording ? stopRecording : startRecording} 
            className={`p-2.5 rounded-xl text-sm font-medium transition active:scale-95 shadow-md flex items-center justify-center ${
              isRecording 
                ? 'bg-red-600 text-white hover:bg-red-500' 
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400'
            }`}
          >
            {isRecording ? '⏹️' : '🎙️'}
          </button>
        ) : (
          <button 
            type="submit" 
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition active:scale-95 shadow-md shadow-emerald-900/20"
          >
            Отправить
          </button>
        )}
      </form>
    </>
  );
}