const { getAiConfig } = require('../utils/aiConfig');
const { fetchComplete } = require('../services/aiAssistant');

const getStatus = (req, res) => {
    const cfg = getAiConfig();
    res.json({ enabled: cfg.enabled, ready: cfg.ready });
};

const complete = async (req, res) => {
    const cfg = getAiConfig();
    if (!cfg.enabled) {
        return res.status(503).json({ error: 'Ассистент пока выключен', enabled: false });
    }
    if (!cfg.ready) {
        return res.status(503).json({ error: 'Ассистент не настроен', enabled: true, ready: false });
    }

    const message = String(req.body?.message || '').trim();
    if (!message) {
        return res.status(400).json({ error: 'Нет текста' });
    }

    try {
        const answer = await fetchComplete({
            userId: req.userId,
            chatId: `user_${req.userId}`,
            message: message.slice(0, 2000),
            history: Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [],
        });
        if (!answer) {
            return res.status(204).end();
        }
        res.json({ response: answer });
    } catch (err) {
        console.error('[ai] /complete', err.message);
        res.status(503).json({ error: 'Ассистент сейчас недоступен' });
    }
};

module.exports = { getStatus, complete };
