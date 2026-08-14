const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');

const s3Config = {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'ru-central1',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
    forcePathStyle: true,
};

const s3Client = new S3Client(s3Config);
const BUCKET = process.env.S3_BUCKET;
const PUBLIC_URL = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');

const ALLOWED_EXT = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'mp3', 'mp4', 'webm', 'ogg', 'wav', 'aac',
]);

const generateFileName = (originalName, mimeType) => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const rawExt = path.basename(originalName || 'file').split('.').pop() || '';
    let ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!ALLOWED_EXT.has(ext)) {
        if (mimeType?.startsWith('audio/')) ext = 'webm';
        else if (mimeType?.startsWith('video/')) ext = 'mp4';
        else ext = 'jpg';
    }
    return `${timestamp}-${random}.${ext}`;
};

/** Извлекает S3 key из полного URL или локального /uploads/... пути */
const getKeyFromUrl = (urlOrPath) => {
    if (!urlOrPath || typeof urlOrPath !== 'string') return null;

    if (urlOrPath.startsWith('/uploads/')) {
        return urlOrPath.replace(/^\//, '');
    }

    if (PUBLIC_URL && urlOrPath.startsWith(PUBLIC_URL)) {
        return urlOrPath.slice(PUBLIC_URL.length).replace(/^\//, '');
    }

    const idx = urlOrPath.indexOf('/uploads/');
    if (idx !== -1) {
        return urlOrPath.slice(idx + 1);
    }

    return null;
};

const uploadFile = async (fileBuffer, originalName, mimeType, folder = 'uploads') => {
    const fileName = generateFileName(originalName, mimeType);
    const key = `${folder}/${fileName}`;

    // Локальный fallback, если S3 не настроен
    if (!BUCKET || !PUBLIC_URL || !process.env.S3_ACCESS_KEY) {
        return saveLocally(fileBuffer, key, fileName);
    }

    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType || 'application/octet-stream',
            // Без ACL: у Yandex Object Storage ACL часто отключены,
            // публичность задаётся политикой бакета.
        });

        await s3Client.send(command);

        return {
            key,
            url: `${PUBLIC_URL}/${key}`,
            fileName,
        };
    } catch (err) {
        console.error('❌ S3 PutObject failed, fallback to local:', err.message);
        return saveLocally(fileBuffer, key, fileName);
    }
};

const saveLocally = async (fileBuffer, key, fileName) => {
    const fs = require('fs');
    const fsp = fs.promises;
    const localPath = path.join(__dirname, '../../public', key);
    await fsp.mkdir(path.dirname(localPath), { recursive: true });
    await fsp.writeFile(localPath, fileBuffer);
    console.log('💾 Файл сохранён локально:', key);
    return {
        key,
        url: `/${key}`,
        fileName,
    };
};

const deleteFile = async (keyOrUrl) => {
    if (!keyOrUrl || !BUCKET) return false;

    let key = keyOrUrl;
    if (typeof keyOrUrl === 'string' && (keyOrUrl.startsWith('http') || keyOrUrl.startsWith('/'))) {
        key = getKeyFromUrl(keyOrUrl);
    }
    if (!key) return false;

    const command = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });
    await s3Client.send(command);
    return true;
};

/** Удаляет старый аватар (локальный файл или S3), ошибки глотаем */
const deleteAvatarIfExists = async (avatar) => {
    if (!avatar || typeof avatar !== 'string') return;

    try {
        if (avatar.startsWith('/uploads/')) {
            const fs = require('fs');
            const fullPath = path.join(__dirname, '../../public', avatar);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
            return;
        }

        const key = getKeyFromUrl(avatar);
        if (key) {
            await deleteFile(key);
        }
    } catch (err) {
        console.warn('⚠️ Не удалось удалить старый аватар:', err.message);
    }
};

module.exports = {
    uploadFile,
    deleteFile,
    getKeyFromUrl,
    deleteAvatarIfExists,
};
