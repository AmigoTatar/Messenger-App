import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ResetPassword({ apiBaseUrl }) {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [passwordErrors, setPasswordErrors] = useState([]);

    // Проверка, что токен есть
    useEffect(() => {
        if (!token) {
            setError('❌ Неверная ссылка для сброса пароля');
        }
    }, [token]);

    const validatePassword = (pwd) => {
        const errors = [];
        if (pwd.length < 8) errors.push('минимум 8 символов');
        if (!/[A-Z]/.test(pwd)) errors.push('заглавную букву');
        if (!/[a-z]/.test(pwd)) errors.push('строчную букву');
        if (!/[0-9]/.test(pwd)) errors.push('цифру');
        if (!/[!@#$%^&*]/.test(pwd)) errors.push('спецсимвол (!@#$%^&*)');
        setPasswordErrors(errors);
        return errors.length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!token) {
            setError('❌ Неверная ссылка для сброса пароля');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('❌ Пароли не совпадают');
            return;
        }

        if (!validatePassword(newPassword)) {
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${apiBaseUrl}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Ошибка при сбросе пароля');
            setSuccess(true);
            setTimeout(() => navigate('/'), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (error && !token) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900 px-4">
                <div className="w-full max-w-md space-y-4 rounded-2xl bg-white dark:bg-zinc-950 p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center">
                    <h2 className="text-2xl font-bold text-red-500">❌ Ошибка</h2>
                    <p className="text-zinc-600 dark:text-zinc-400">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition"
                    >
                        Вернуться на главную
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900 px-4">
            <div className="w-full max-w-md space-y-6 rounded-2xl bg-white dark:bg-zinc-950 p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        🔐 Сброс пароля
                    </h2>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        Введите новый пароль
                    </p>
                </div>

                {success ? (
                    <div className="text-center space-y-4">
                        <div className="rounded-xl bg-emerald-500/10 p-4 text-emerald-500 border border-emerald-500/20">
                            ✅ Пароль успешно изменён!
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Перенаправление на главную...
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500 text-center border border-red-500/20">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Новый пароль (минимум 8 символов)
                            </label>
                            <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => {
                                    setNewPassword(e.target.value);
                                    validatePassword(e.target.value);
                                }}
                                className="mt-1 block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-4 py-3 text-zinc-900 dark:text-white shadow-sm focus:border-emerald-500 focus:outline-none transition-colors duration-200"
                                placeholder="••••••••"
                            />
                            {passwordErrors.length > 0 && (
                                <div className="text-red-500 text-xs mt-2 space-y-0.5">
                                    {passwordErrors.map((err, i) => (
                                        <div key={i}>• {err}</div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Подтвердите пароль
                            </label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-4 py-3 text-zinc-900 dark:text-white shadow-sm focus:border-emerald-500 focus:outline-none transition-colors duration-200"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !token}
                            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 font-semibold text-white shadow-md shadow-emerald-600/20 active:scale-98 transition duration-200 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? '⏳ Сохранение...' : 'Сохранить новый пароль'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}