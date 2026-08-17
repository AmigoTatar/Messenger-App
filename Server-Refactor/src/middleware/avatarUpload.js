const multer = require('multer');

const imageFileFilter = (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype)) {
        cb(null, true);
        return;
    }
    cb(new Error('Разрешены только изображения: jpeg, png, gif, webp'));
};

/** Memory storage → дальше грузим в Yandex S3 (аватары и медиа) */
const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: imageFileFilter,
});

module.exports = { avatarUpload, imageFileFilter };
