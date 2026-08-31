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
        if (/\.(jpe?g|png|gif|webp|bmp)$/i.test(raw)) {
            return raw.slice(-80);
        }
    } catch {
        /* ignore */
    }
    return `potok-${Date.now()}.jpg`;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const s = String(reader.result || '');
            resolve(s.includes(',') ? s.split(',')[1] : s);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function fetchImageBlob(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Не удалось загрузить фото');
    return res.blob();
}

async function shareNativeFile(url) {
    const name = fileNameFromUrl(url);
    const path = `share/${name}`;
    const blob = await fetchImageBlob(url);
    const data = await blobToBase64(blob);
    await Filesystem.writeFile({
        path,
        data,
        directory: Directory.Cache,
        recursive: true,
    });
    const { uri } = await Filesystem.getUri({
        path,
        directory: Directory.Cache,
    });
    await Share.share({
        files: [uri],
        dialogTitle: 'Поделиться фото',
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

async function saveNative(url) {
    const name = fileNameFromUrl(url);
    const blob = await fetchImageBlob(url);
    const data = await blobToBase64(blob);
    const write = () => Filesystem.writeFile({
        path: `Potok/${name}`,
        data,
        directory: Directory.Documents,
        recursive: true,
    });
    try {
        await write();
        return;
    } catch {
        const perm = await Filesystem.requestPermissions();
        if (perm?.publicStorage !== 'granted') {
            throw new Error('no-permission');
        }
        await write();
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
        await saveNative(url);
        return 'saved';
    } catch (err) {
        if (isShareCanceled(err)) return 'canceled';
        try {
            await shareNativeFile(url);
            return 'shared';
        } catch (shareErr) {
            if (isShareCanceled(shareErr)) return 'canceled';
            throw new Error('Не удалось сохранить фото');
        }
    }
}
