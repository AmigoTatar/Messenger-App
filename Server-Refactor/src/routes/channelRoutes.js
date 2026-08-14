const express = require('express');
const router = express.Router();
const { validateChannel } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/avatarUpload');
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

router.use(authenticateToken);

router.get('/test', (req, res) => {
    res.json({ message: 'Channel routes working!' });
});

router.get('/search', searchChannels);

router.post('/join-requests/:requestId/approve', approveJoinRequest);
router.post('/join-requests/:requestId/reject', rejectJoinRequest);

router.post('/:channelId/join-request', createJoinRequest);
router.get('/:channelId/join-requests', getJoinRequests);
router.delete('/:channelId/join-request', cancelJoinRequest);

router.get('/', getChannels);
router.get('/:channelId', getChannel);
router.post('/', authenticateToken, validateChannel, createChannel);
router.put('/:channelId', avatarUpload.single('avatar'), updateChannel);
router.delete('/:channelId', deleteChannel);

router.get('/:channelId/members', getChannelMembers);
router.post('/:channelId/members', addChannelMember);
router.delete('/:channelId/members/:userId', removeChannelMember);

module.exports = router;
