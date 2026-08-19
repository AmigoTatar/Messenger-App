const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { blockUser, unblockUser, getBlockStatus } = require('../controllers/blockController');

router.use(authenticateToken);
router.get('/status', getBlockStatus);
router.post('/', blockUser);
router.delete('/:userId', unblockUser);

module.exports = router;
