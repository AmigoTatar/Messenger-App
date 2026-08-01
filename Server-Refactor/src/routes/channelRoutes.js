const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { validateChannel } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const {
    getChannels,
    getChannel,
    createChannel,
    updateChannel,
    deleteChannel,
    getChannelMembers,
    addChannelMember,
    removeChannelMember,
    searchChannels,
    createJoinRequest,
    getJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    cancelJoinRequest,
} = require('../controllers/channelController');

// Настройка multer для аватарок каналов
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Все маршруты требуют аутентификации
router.use(authenticateToken);

// ✅ ТЕСТОВЫЙ РОУТ
router.get('/test', (req, res) => {
    res.json({ message: 'Channel routes working!' });
});
// ==============================================
// ✅ 1. СПЕЦИФИЧНЫЕ РОУТЫ (БЕЗ ПАРАМЕТРОВ)
// ==============================================
router.get('/search', searchChannels);

// ==============================================
// ✅ 2. ГЛОБАЛЬНЫЕ РОУТЫ ДЛЯ ЗАЯВОК (БЕЗ CHANNELID)
// ==============================================
router.post('/join-requests/:requestId/approve', approveJoinRequest);
router.post('/join-requests/:requestId/reject', rejectJoinRequest);

// ==============================================
// ✅ 3. РОУТЫ ДЛЯ ЗАЯВОК (С ПАРАМЕТРОМ :channelId)
// ==============================================
router.post('/:channelId/join-request', createJoinRequest);
router.get('/:channelId/join-requests', getJoinRequests);
router.delete('/:channelId/join-request', cancelJoinRequest);

// ==============================================
// ✅ 4. CRUD КАНАЛОВ (С ПАРАМЕТРОМ :channelId)
// ==============================================
router.get('/', getChannels);
router.get('/:channelId', getChannel);
router.post('/', authenticateToken, validateChannel, createChannel);
router.put('/:channelId', upload.single('avatar'), updateChannel);
router.delete('/:channelId', deleteChannel);

// ==============================================
// ✅ 5. УЧАСТНИКИ (С ПАРАМЕТРОМ :channelId)
// ==============================================
router.get('/:channelId/members', getChannelMembers);
router.post('/:channelId/members', addChannelMember);
router.delete('/:channelId/members/:userId', removeChannelMember);

module.exports = router;