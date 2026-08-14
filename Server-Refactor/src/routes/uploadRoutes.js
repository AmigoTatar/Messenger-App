const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFile } = require('../controllers/uploadController');
const { authenticateToken } = require('../middleware/auth');

const ALLOWED = /^image\/(jpeg|jpg|png|gif|webp)$|^audio\/(mpeg|mp4|webm|ogg|wav|aac)$|^video\/(mp4|webm)$/i;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED.test(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new Error('Недопустимый тип файла'));
    },
});

router.post('/', authenticateToken, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
        }
        next();
    });
}, uploadFile);

module.exports = router;
