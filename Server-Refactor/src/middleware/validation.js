

const { containsBadWord } = require('../utils/badWords');

// Валидация регистрации
function validateRegister(req, res, next) {
    const { username, email, password } = req.body;

    const errors = [];

    if (!username || username.length < 3) {
        errors.push('Имя пользователя должно содержать минимум 3 символа');
    } else if (containsBadWord(username)) {
        errors.push('Имя содержит недопустимые слова. Выберите другой никнейм');
    }

    if (!email || !email.includes('@') || !email.includes('.')) {
        errors.push('Введите корректный email');
    }

    if (!password || password.length < 8) {
        errors.push('Пароль должен содержать минимум 8 символов');
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors: errors });
    }

    next();
}

// Валидация сообщения
function validateMessage(req, res, next) {
    const { text, mediaUrl } = req.body;

    if (!text && !mediaUrl) {
        return res.status(400).json({ error: 'Сообщение должно содержать текст или медиа' });
    }

    if (text && text.length > 10000) {
        return res.status(400).json({ error: 'Сообщение слишком длинное (максимум 10000 символов)' });
    }

    next();
}

// Валидация поиска
function validateSearch(req, res, next) {
    const { query } = req.query;

    if (!query || query.length < 2) {
        return res.status(400).json({ error: 'Поисковый запрос должен содержать минимум 2 символа' });
    }

    if (query.length > 100) {
        return res.status(400).json({ error: 'Поисковый запрос слишком длинный' });
    }

    next();
}

// Валидация логина
function validateLogin(req, res, next) {
    const { username, password } = req.body;

    if (!username || username.length < 3) {
        return res.status(400).json({ error: 'Имя пользователя обязательно (минимум 3 символа)' });
    }

    if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Пароль обязателен (минимум 8 символов)' });
    }

    next();
}

// Валидация создания канала
function validateChannel(req, res, next) {
    const { name } = req.body;

    if (!name || name.trim().length < 3) {
        return res.status(400).json({ error: 'Название канала должно содержать минимум 3 символа' });
    }

    if (name.trim().length > 100) {
        return res.status(400).json({ error: 'Название канала слишком длинное (максимум 100 символов)' });
    }

    next();
}

// Валидация создания группы
function validateChat(req, res, next) {
    const { name } = req.body;

    if (!name || name.trim().length < 3) {
        return res.status(400).json({ error: 'Название чата должно содержать минимум 3 символа' });
    }

    if (name.trim().length > 100) {
        return res.status(400).json({ error: 'Название чата слишком длинное (максимум 100 символов)' });
    }

    next();
}

// Валидация обновления профиля
function validateProfile(req, res, next) {
    const { username } = req.body;

    if (!username || username.trim().length < 3) {
        return res.status(400).json({ error: 'Имя должно содержать минимум 3 символа' });
    }

    if (username.trim().length > 50) {
        return res.status(400).json({ error: 'Имя слишком длинное (максимум 50 символов)' });
    }

    if (containsBadWord(username.trim())) {
        return res.status(400).json({ error: 'Имя содержит недопустимые слова. Выберите другой никнейм' });
    }

    next();
}

module.exports = {
    validateRegister,
    validateLogin,
    validateMessage,
    validateSearch,
    validateChannel,
    validateChat,
    validateProfile
};