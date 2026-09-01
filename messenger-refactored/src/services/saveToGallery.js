import { Capacitor, registerPlugin } from '@capacitor/core';

const SaveToGallery = registerPlugin('SaveToGallery');

export async function saveFileToGallery(fileUri, fileName) {
    if (!Capacitor.isNativePlatform()) {
        throw new Error('Только в приложении');
    }
    await SaveToGallery.saveImage({
        path: fileUri,
        fileName: fileName || 'potok.jpg',
    });
}
