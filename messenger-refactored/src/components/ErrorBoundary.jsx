// src/components/ErrorBoundary.jsx
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ ErrorBoundary поймал ошибку:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 p-6">
          <div className="text-center text-zinc-700 dark:text-zinc-300 max-w-md">
            <div className="text-6xl mb-4">😵</div>
            <h2 className="text-xl font-bold mb-2 text-zinc-800 dark:text-white">
              Что-то пошло не так
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {this.state.error?.message || 'Попробуйте перезагрузить страницу'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition"
            >
              🔄 Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}