/**
 * Прокси к отдельному AI-сервису (potok-ai-bot).
 * Пока AI_ENABLED / AI_ASSISTANT_ENABLED не true — полный no-op.
 * LLM на этом процессе не запускается.
 */
const { getAiConfig } = require('../utils/aiConfig');

const HISTORY_LIMIT = 10;

function isAssistantPeer(receiverId, senderId) {
    const cfg = getAiConfig();
    if (!cfg.ready) return false;
    if (Number(senderId) === cfg.userId) return false;
    return Number(receiverId) === cfg.userId;
}

async function fetchComplete({ userId, chatId, message, history }) {
    const cfg = getAiConfig();
    if (!cfg.ready) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
        const res = await fetch(`${cfg.serviceUrl}/v1/complete`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${cfg.serviceToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                chat_id: chatId,
                message,
                history: Array.isArray(history) ? history : [],
            }),
        });
        if (res.status === 204) return null;
        if (!res.ok) {
            throw new Error(`complete ${res.status}`);
        }
        const body = await res.json();
        const text = body && body.response ? String(body.response).trim() : '';
        return text || null;
    } finally {
        clearTimeout(timer);
    }
}

async function maybeReplyToUser({ io, prisma, emitToUser, savedMessage, senderId, receiverId }) {
    if (!isAssistantPeer(receiverId, senderId)) return;
    if (!savedMessage || savedMessage.mediaUrl || savedMessage.isForwarded) return;
    const text = (savedMessage.text || '').trim();
    if (!text) return;

    const cfg = getAiConfig();
    const rows = await prisma.message.findMany({
        where: {
            channelId: null,
            chatId: null,
            OR: [
                { senderId, receiverId: cfg.userId },
                { senderId: cfg.userId, receiverId: senderId },
            ],
        },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT + 1,
        select: { id: true, text: true, senderId: true },
    });

    const history = rows
        .reverse()
        .filter((row) => row.id !== savedMessage.id && row.text)
        .map((row) => ({
            role: row.senderId === cfg.userId ? 'assistant' : 'user',
            content: row.text,
        }));

    let answer;
    try {
        answer = await fetchComplete({
            userId: senderId,
            chatId: `user_${cfg.userId}`,
            message: text,
            history,
        });
    } catch (err) {
        answer = 'Ассистент сейчас недоступен. Попробуйте позже.';
        console.error('[ai] complete failed', err.message);
    }
    if (!answer) return;

    const botMessage = await prisma.message.create({
        data: {
            text: answer,
            senderId: cfg.userId,
            receiverId: senderId,
            status: 'unread',
        },
        include: {
            sender: { select: { id: true, username: true } },
        },
    });

    const payload = {
        id: botMessage.id,
        text: botMessage.text,
        mediaUrl: botMessage.mediaUrl,
        mediaType: botMessage.mediaType,
        status: botMessage.status,
        createdAt: botMessage.createdAt,
        senderId: botMessage.senderId,
        receiverId: botMessage.receiverId,
        channelId: null,
        chatId: null,
        sender: botMessage.sender,
        activeChatId: `user_${cfg.userId}`,
        isForwarded: false,
    };

    emitToUser(io, senderId, 'receive_message', payload);
    emitToUser(io, senderId, 'chat_updated', {
        chatId: cfg.userId,
        lastMessage: payload,
    });
}

module.exports = { maybeReplyToUser, isAssistantPeer, fetchComplete, getAiConfig };
