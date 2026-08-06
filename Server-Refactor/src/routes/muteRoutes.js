
const express = require('express');
const router = express.Router();
const { toggleMute, getMuteStatus } = require('../controllers/muteController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, toggleMute);
router.get('/status', authenticateToken, getMuteStatus);      
router.get('/mute-status', authenticateToken, getMuteStatus); 

module.exports = router;