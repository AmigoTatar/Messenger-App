import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../LoadingSpinner';
import Avatar from '../Avatar';

export default function AddContactModal({ isOpen, onClose, onSearch, onAdd, existingContacts }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(null);
    const [searched, setSearched] = useState(false); // ← НОВОЕ

    // Сброс при закрытии
    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setResults([]);
            setSearched(false);
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSearch = async () => {
        if (!query.trim() || query.length < 2) return;
        setSearched(true); 
        setLoading(true);
        try {
            const data = await onSearch(query);
            setResults(data);
        } catch (err) {
            console.error('Ошибка поиска:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (userId) => {
        setAdding(userId);
        try {
            await onAdd(userId);
            setResults(prev => prev.filter(u => u.id !== userId));
        } catch (err) {
            console.error('Ошибка добавления:', err);
        } finally {
            setAdding(null);
        }
    };

    const isContact = (userId) => {
        return existingContacts?.some(c => c.id === userId);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-white">
                        ➕ Добавить контакт
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
                        placeholder="Введите имя или email..."
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

                {loading ? (
                    <div className="flex justify-center py-8">
                        <LoadingSpinner size="md" />
                    </div>
                ) : (
                    <div className="max-h-60 overflow-y-auto space-y-1">
                        {/* Показываем, только если пользователь нажал на лупу и ничего не найдено */}
                        {searched && query.length >= 2 && results.length === 0 && (
                            <div className="text-center text-sm text-zinc-400 py-8">
                                🔍 Пользователи не найдены
                            </div>
                        )}

                        {/* Если ещё не нажимали на лупу — показываем подсказку */}
                        {!searched && query.length >= 2 && results.length === 0 && (
                            <div className="text-center text-sm text-zinc-400 py-8">
                                💡 Нажмите 🔍 для поиска
                            </div>
                        )}

                        {results.map((user) => {
                            const alreadyContact = isContact(user.id);
                            return (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <Avatar
                                          avatar={user.avatar}
                                          name={user.username}
                                          size="sm"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                                {user.username}
                                            </p>
                                            <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAdd(user.id)}
                                        disabled={alreadyContact || adding === user.id}
                                        className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                                            alreadyContact
                                                ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800'
                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                        }`}
                                    >
                                        {adding === user.id ? (
                                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : alreadyContact ? (
                                            '✅ В контактах'
                                        ) : (
                                            '➕ Добавить'
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}