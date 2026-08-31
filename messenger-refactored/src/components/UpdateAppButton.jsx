import { useCallback, useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { API_BASE_URL, APK_DOWNLOAD, isNativeApp } from '../config';

async function installedVersionCode() {
  try {
    const info = await CapApp.getInfo();
    const n = Number(info.build);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    /* web or plugin missing */
  }
  return APK_DOWNLOAD.versionCode;
}

async function fetchLatest() {
  const res = await fetch(`${API_BASE_URL}/version.json?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('version');
  const data = await res.json();
  const versionCode = Number(data?.versionCode);
  if (!Number.isFinite(versionCode)) throw new Error('version');
  return {
    versionCode,
    versionName: data.versionName || '',
    apkUrl: typeof data.apkUrl === 'string' ? data.apkUrl : APK_DOWNLOAD.url,
  };
}

export default function UpdateAppButton({ compact = false, block = false }) {
  const [latest, setLatest] = useState(null);

  const check = useCallback(async () => {
    if (!isNativeApp) return;
    try {
      const remote = await fetchLatest();
      const local = await installedVersionCode();
      setLatest(remote.versionCode > local ? remote : null);
    } catch {
      setLatest(null);
    }
  }, []);

  useEffect(() => {
    check();
    if (!isNativeApp) return undefined;
    let handle;
    CapApp.addListener('resume', check).then((h) => {
      handle = h;
    });
    return () => {
      handle?.remove();
    };
  }, [check]);

  if (!isNativeApp || !latest) return null;

  const openApk = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const path = latest.apkUrl.startsWith('http')
      ? latest.apkUrl
      : `${API_BASE_URL}${latest.apkUrl.startsWith('/') ? '' : '/'}${latest.apkUrl}`;
    try {
      await CapApp.openUrl({ url: path });
    } catch {
      window.open(path, '_blank', 'noopener,noreferrer');
    }
  };

  if (compact) {
    return (
      <button type="button" onClick={openApk} className="hover:text-emerald-500 transition text-emerald-600 dark:text-emerald-400 font-medium">
        Обновить
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openApk}
      className={
        block
          ? 'w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition'
          : 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition'
      }
    >
      Обновить приложение
      {latest.versionName ? ` ${latest.versionName}` : ''}
    </button>
  );
}
