import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export default function AiAssistant() {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('messenger_dark_mode') || 'false');
      document.documentElement.classList.toggle('dark', !!saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let cancelled = false;
    let handle = null;
    CapApp.addListener('backButton', () => {
      navigate('/');
    }).then((h) => {
      if (cancelled) {
        h.remove();
        return;
      }
      handle = h;
    });
    return () => {
      cancelled = true;
      if (handle) handle.remove();
    };
  }, [navigate]);

  return (
    <div className="h-full flex flex-col bg-zinc-100 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100">
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-3 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
        >
          ← Назад
        </button>
        <h1 className="text-base font-semibold">Potok AI</h1>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
          <div className="text-5xl mb-4">🤖</div>
          <p className="text-lg font-medium text-zinc-800 dark:text-zinc-100">
            Скоро умный ассистент, ожидайте в версии 1.2
          </p>
          <p className="mt-3 text-sm text-zinc-400">
            Пока это заглушка. Бота нет, запросы никуда не уходят.
          </p>
        </div>
      </main>
    </div>
  );
}
