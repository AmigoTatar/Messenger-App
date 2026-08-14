const express = require('express');
const router = express.Router();
const { register, login, logout } = require('../controllers/authController');
const { validateRegister } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    message: { error: 'Слишком много попыток. Попробуйте через 5 минут.' },
    standardHeaders: true,
    legacyHeaders: false
});

router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, login);
router.post('/logout', authenticateToken, logout);

module.exports = router;
