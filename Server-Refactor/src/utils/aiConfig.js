function envTruthy(name) {
    const v = String(process.env[name] || '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function getAiConfig() {
    const enabled = envTruthy('AI_ENABLED') || envTruthy('AI_ASSISTANT_ENABLED');
    const userId = Number(process.env.AI_USER_ID || 0);
    const serviceUrl = String(process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const serviceToken = String(process.env.AI_SERVICE_TOKEN || '');
    const ready = Boolean(enabled && userId > 0 && serviceToken);
    return {
        enabled,
        userId: Number.isInteger(userId) && userId > 0 ? userId : 0,
        serviceUrl,
        serviceToken,
        ready,
    };
}

module.exports = { getAiConfig };
