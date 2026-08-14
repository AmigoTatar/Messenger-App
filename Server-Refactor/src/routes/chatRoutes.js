const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');
const { validateChat } = require('../middleware/validation');
const { avatarUpload } = require('../middleware/avatarUpload');
const {
    getChats,
    createChat,
    updateChat,
    deleteChat,
    getChatMembers,
    addChatMember,
    removeChatMember,
} = require('../controllers/chatController');

router.get('/', authenticateToken, getChats);
router.post('/', authenticateToken, validateChat, createChat);
router.put('/:chatId', authenticateToken, avatarUpload.single('avatar'), updateChat);
router.delete('/:chatId', authenticateToken, deleteChat);
router.get('/:chatId/members', authenticateToken, getChatMembers);
router.post('/:chatId/members', authenticateToken, addChatMember);
router.delete('/:chatId/members/:userId', authenticateToken, removeChatMember);

module.exports = router;
