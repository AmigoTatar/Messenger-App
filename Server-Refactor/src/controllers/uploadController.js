const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { uploadFile } = require('../services/s3Service');

const uploadController = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        console.log(' Загрузка файла в S3:', req.file.originalname);
        console.log(' Размер:', req.file.size);

        const result = await uploadFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        res.json({
            fileUrl: result.url,
            key: result.key,
            fileName: result.fileName,
        });
    } catch (error) {
        console.error('❌ Ошибка загрузки в S3:', error);
        res.status(500).json({ error: 'Не удалось загрузить файл' });
    }
};

module.exports = { uploadFile: uploadController };