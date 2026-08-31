import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from '../config';

function isShareCanceled(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    return err?.name === 'AbortError' || msg.includes('cancel') || msg.includes('share canceled');
}

function fileNameFromUrl(url) {
    try {
        const raw = decodeURIComponent(String(url).split('?')[0].split('/').pop() || '');
        const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
        if (/\.(jpe?g|png|gif|webp|bmp)$/i.test(safe)) {
            return safe.slice(-80);
        }
    } catch {
        /* ignore */
    }
    return `potok-${Date.now()}.jpg`;
}

async function fetchImageBlob(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Не удалось загрузить фото');
    return res.blob();
}

/** Native HTTP — обходит CORS WebView (S3 с <img> открывается, fetch с localhost — нет). */
async function nativeDownloadTo(url, path, directory) {
    const downloaded = await Filesystem.downloadFile({
        url,
        path,
        directory,
        recursive: true,
    });
    if (downloaded?.path) return downloaded.path;
    const { uri } = await Filesystem.getUri({ path, directory });
    return uri;
}

async function shareNativeFile(url, dialogTitle = 'Поделиться фото') {
    const name = fileNameFromUrl(url);
    const path = `share/${name}`;
    await nativeDownloadTo(url, path, Directory.Cache);
    const { uri } = await Filesystem.getUri({
        path,
        directory: Directory.Cache,
    });
    await Share.share({
        files: [uri],
        dialogTitle,
    });
}

async function shareWeb(url) {
    let file = null;
    try {
        const blob = await fetchImageBlob(url);
        file = new File([blob], fileNameFromUrl(url), { type: blob.type || 'image/jpeg' });
    } catch {
        file = null;
    }

    if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Potok' });
        return;
    }
    if (navigator.share) {
        await navigator.share({ title: 'Potok', url });
        return;
    }
    throw new Error('Шаринг недоступен в этом браузере');
}

export async function shareImage(url) {
    if (!url) throw new Error('Нет фото');

    try {
        if (isNativeApp) {
            try {
                await shareNativeFile(url);
            } catch (err) {
                if (isShareCanceled(err)) return;
                await Share.share({
                    url,
                    dialogTitle: 'Поделиться фото',
                });
            }
            return;
        }
        await shareWeb(url);
    } catch (err) {
        if (isShareCanceled(err)) return;
        throw err;
    }
}

async function saveWeb(url) {
    const blob = await fetchImageBlob(url);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileNameFromUrl(url);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

/**
 * Сначала Documents (без запроса WRITE_EXTERNAL_STORAGE — на Android 13+ его нет).
 * Если папка недоступна — Cache + системный шаринг «сохранить в галерею».
 */
async function saveNative(url) {
    const name = fileNameFromUrl(url);
    try {
        await nativeDownloadTo(url, `Potok/${name}`, Directory.Documents);
        return 'saved';
    } catch {
        await shareNativeFile(url, 'Сохранить фото');
        return 'shared';
    }
}

/**
 * @returns {'saved' | 'shared' | 'canceled' | 'opened'}
 */
export async function saveImage(url) {
    if (!url) throw new Error('Нет фото');

    if (!isNativeApp) {
        try {
            await saveWeb(url);
            return 'saved';
        } catch {
            window.open(url, '_blank', 'noopener,noreferrer');
            return 'opened';
        }
    }

    try {
        return await saveNative(url);
    } catch (err) {
        if (isShareCanceled(err)) return 'canceled';
        throw new Error('Не удалось сохранить фото');
    }
}
