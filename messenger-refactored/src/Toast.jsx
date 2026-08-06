import { useEffect, useState } from 'react';

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  const styles = {
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-blue-500 text-white',
  };

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg ${styles[type]} transition-all duration-300 animate-fadeIn`}>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={() => {
            setVisible(false);
            if (onClose) setTimeout(onClose, 300);
          }}
          className="opacity-70 hover:opacity-100 text-white text-lg leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}