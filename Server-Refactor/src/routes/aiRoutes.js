const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const { getStatus, complete } = require('../controllers/aiController');

const router = express.Router();

const completeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Слишком много запросов к ассистенту' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/status', getStatus);
router.post('/complete', authenticateToken, completeLimiter, complete);

module.exports = router;
