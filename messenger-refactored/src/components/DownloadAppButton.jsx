import { APK_DOWNLOAD, isNativeApp } from '../config';

export default function DownloadAppButton({ compact = false }) {
  if (isNativeApp) return null;

  if (compact) {
    return (
      <a
        href={APK_DOWNLOAD.url}
        download={APK_DOWNLOAD.filename}
        className="hover:text-emerald-500 transition"
      >
        Приложение
      </a>
    );
  }

  return (
    <a
      href={APK_DOWNLOAD.url}
      download={APK_DOWNLOAD.filename}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
    >
      📱 Скачать приложение
    </a>
  );
}
