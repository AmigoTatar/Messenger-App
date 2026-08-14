import { API_BASE_URL } from '../config';

/**
 * Полный URL для аватарки (/uploads → API, https → as-is)
 */
export const getAvatarUrl = (avatar) => {
    if (!avatar || typeof avatar !== 'string') return null;

    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
        return avatar;
    }

    if (avatar.startsWith('/uploads/')) {
        return `${API_BASE_URL}${avatar}`;
    }

    return null;
};

export const getInitials = (username) => {
    if (!username || typeof username !== 'string') return '?';
    const trimmed = username.trim();
    if (!trimmed) return '?';
    return trimmed.charAt(0).toUpperCase();
};

/**
 * Картинка: локальный /uploads/ или полный http(s) URL (S3)
 */
export const isImageAvatar = (avatar) => {
    if (!avatar || typeof avatar !== 'string') return false;
    return (
        avatar.startsWith('/uploads/') ||
        avatar.startsWith('http://') ||
        avatar.startsWith('https://')
    );
};

/**
 * Эмодзи / текст-заглушка (не URL и не /uploads/)
 */
export const isEmojiAvatar = (avatar) => {
    if (!avatar || typeof avatar !== 'string') return false;
    return !isImageAvatar(avatar);
};

export const defaultAvatarEmoji = (type) => {
    if (type === 'channel') return '📢';
    if (type === 'group') return '💬';
    return '👤';
};
