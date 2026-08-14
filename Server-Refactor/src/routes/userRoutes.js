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
router.put('/avatar', authenticateToken, avatarUpload.single('avatar'), updateAvatar);

module.exports = router;
