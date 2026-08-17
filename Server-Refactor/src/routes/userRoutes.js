const express = require('express');
const router = express.Router();
const { validateProfile } = require('../middleware/validation');
const {
    getUsers,
    updateProfile,
    updateAvatar,
} = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/avatarUpload');

router.get('/', authenticateToken, getUsers);
router.put('/profile', authenticateToken, validateProfile, updateProfile);
router.put('/avatar', authenticateToken, (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Файл слишком большой. Максимум 20 МБ' });
            }
            return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
        }
        next();
    });
}, updateAvatar);

module.exports = router;
