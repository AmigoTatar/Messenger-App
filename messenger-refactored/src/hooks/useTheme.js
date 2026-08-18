import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('messenger_dark_mode');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('messenger_dark_mode', JSON.stringify(isDarkMode));

    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: isDarkMode ? '#18181b' : '#ffffff' });
        await StatusBar.setStyle({ style: isDarkMode ? Style.Dark : Style.Light });
      } catch (err) {
        console.warn('StatusBar:', err?.message || err);
      }
    })();
  }, [isDarkMode]);

  return { isDarkMode, toggleTheme: () => setIsDarkMode(prev => !prev) };
}