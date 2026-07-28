// hooks/useTheme.js
import { useState, useEffect } from 'react';

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
  }, [isDarkMode]);

  return { isDarkMode, toggleTheme: () => setIsDarkMode(prev => !prev) };
}