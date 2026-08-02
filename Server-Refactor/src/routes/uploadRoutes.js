const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFile } = require('../controllers/uploadController');
const { authenticateToken } = require('../middleware/auth');

// Multer для приёма файла в память
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 МБ
});

router.post('/', authenticateToken, upload.single('file'), uploadFile);

module.exports = router;