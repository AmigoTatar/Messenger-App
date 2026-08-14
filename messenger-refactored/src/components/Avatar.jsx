import React, { useState, useEffect } from 'react';
import {
  getAvatarUrl,
  getInitials,
  isImageAvatar,
  isEmojiAvatar,
  defaultAvatarEmoji,
} from '../utils/avatarUtils';

const SIZE_CLASS = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-lg',
  lg: 'w-11 h-11 text-xl',
  xl: 'w-16 h-16 text-2xl',
  '2xl': 'w-24 h-24 text-4xl',
};

/**
 * Универсальный аватар с fallback:
 * - http(s) / /uploads/ → <img>, при 404 → инициалы или эмодзи
 * - эмодзи/текст → как есть
 * - пусто → инициалы из name или эмодзи по type
 */
export default function Avatar({
  avatar,
  name = '',
  type = 'private',
  size = 'md',
  className = '',
  imgClassName = 'w-full h-full object-cover',
  alt,
}) {
  const [failed, setFailed] = useState(false);
  const url = isImageAvatar(avatar) ? getAvatarUrl(avatar) : null;

  useEffect(() => {
    setFailed(false);
  }, [avatar, url]);

  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md;
  const fallbackEmoji = isEmojiAvatar(avatar)
    ? avatar
    : defaultAvatarEmoji(type);
  const initials = getInitials(name);
  const showImage = Boolean(url) && !failed;

  return (
    <div
      className={`${sizeClass} rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shadow-inner overflow-hidden shrink-0 ${className}`}
      aria-hidden={!alt}
    >
      {showImage ? (
        <img
          src={url}
          alt={alt || name || 'avatar'}
          className={imgClassName}
          onError={() => setFailed(true)}
        />
      ) : name && !isEmojiAvatar(avatar) ? (
        <span className="font-semibold text-zinc-500 dark:text-zinc-400 select-none">
          {initials}
        </span>
      ) : (
        <span className="select-none leading-none">{fallbackEmoji}</span>
      )}
    </div>
  );
}

/**
 * Картинка сообщения/медиа с заглушкой при ошибке загрузки
 */
export function SafeImage({
  src,
  alt = '',
  className = '',
  fallback = '🖼️',
  onClick,
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-200 dark:bg-zinc-800 text-2xl text-zinc-400 ${className}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
      >
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={() => setFailed(true)}
    />
  );
}
