import { CapacitorHttp } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from '../config';
import { saveFileToGallery } from './saveToGallery';

const CACHE_DIR = 'potok-share';

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

async function ensureCacheDir() {
    try {
        await Filesystem.mkdir({
            path: CACHE_DIR,
            directory: Directory.Cache,
            recursive: true,
        });
    } catch {
        /* already exists */
    }
}

function asBase64(data) {
    if (typeof data !== 'string') return null;
    const s = data.trim();
    if (!s) return null;
    return s.includes(',') ? s.split(',')[1] : s;
}

/** Native HTTP + запись в Cache. downloadFile сам mkdir не делает — папки создаём заранее. */
async function cacheNativeFile(url) {
    const name = fileNameFromUrl(url);
    const path = `${CACHE_DIR}/${name}`;
    await ensureCacheDir();

    try {
        await Filesystem.downloadFile({
            url,
            path,
            directory: Directory.Cache,
        });
    } catch {
        const res = await CapacitorHttp.get({
            url,
            responseType: 'arraybuffer',
            connectTimeout: 30000,
            readTimeout: 60000,
        });
        if (res.status < 200 || res.status >= 300) {
            throw new Error('Не удалось скачать фото');
        }
        const data = asBase64(res.data);
        if (!data) throw new Error('Не удалось скачать фото');
        await Filesystem.writeFile({
            path,
            data,
            directory: Directory.Cache,
            recursive: true,
        });
    }

    const { uri } = await Filesystem.getUri({
        path,
        directory: Directory.Cache,
    });
    if (!uri) throw new Error('Не удалось подготовить файл');
    return uri;
}

async function shareNativeFile(url, dialogTitle = 'Поделиться фото') {
    const uri = await cacheNativeFile(url);
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
 * APK: файл в кэш (как «Поделиться»), затем MediaStore → Галерея/Pictures/Potok.
 * Шит шаринга здесь не открываем.
 */
async function saveNative(url) {
    const name = fileNameFromUrl(url);
    const uri = await cacheNativeFile(url);
    await saveFileToGallery(uri, name);
    return 'saved';
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
