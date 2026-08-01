const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');
const { onlineUsers } = require('../socket/socketHandlers');

const deleteFile = (filePath) => {
    if (filePath && filePath.startsWith('/uploads/')) {
        const fullPath = path.join(__dirname, '../../public', filePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }
};

// --- GET /api/channels ---
const getChannels = async (req, res) => {
    try {
        const userId = req.userId;
        const channelMembers = await prisma.channelMember.findMany({
            where: { userId },
            include: {
                channel: {
                    include: {
                        messages: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            include: {
                                sender: { select: { id: true, username: true } }
                            }
                        }
                    }
                }
            }
        });

        const channels = channelMembers.map(member => {
            const channel = member.channel;
            const lastMessage = channel.messages[0] || null;
            const { messages, ...channelData } = channel;
            return { ...channelData, lastMessage };
        });

        res.json(channels);
    } catch (error) {
        console.error('❌ Ошибка получения каналов:', error);
        res.status(500).json({ error: 'Ошибка загрузки каналов' });
    }
};

// --- GET /api/channels/:channelId ---
const getChannel = async (req, res) => {
    try {
         console.log('🔍 getChannel вызвана! channelId:', req.params.channelId);
        const channelId = parseInt(req.params.channelId);
        const userId = req.userId;

        const member = await prisma.channelMember.findFirst({
            where: {
                channelId: channelId,
                userId: userId
            }
        });
        if (!member) {
            return res.status(403).json({ error: 'Вы не участник этого канала' });
        }


        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        sender: { select: { id: true, username: true } }
                    }
                }
            }
        });

        if (!channel) {
            return res.status(404).json({ error: 'Канал не найден' });
        }

        const lastMessage = channel.messages[0] || null;
        const { messages, ...channelData } = channel;
        res.json({ ...channelData, lastMessage });
    } catch (error) {
        console.error('Ошибка получения канала:', error);
        res.status(500).json({ error: 'Ошибка загрузки канала' });
    }
};
// --- POST /api/channels ---
const createChannel = async (req, res) => {
    try {
        const { name, avatar } = req.body;
        const creatorId = req.userId;

        if (!name) {
            return res.status(400).json({ error: 'Название канала обязательно' });
        }

        const userExists = await prisma.user.findUnique({ where: { id: creatorId } });
        if (!userExists) {
            return res.status(400).json({ error: 'Пользователь не найден' });
        }

        const newChannel = await prisma.channel.create({
            data: {
                name: name.trim(),
                avatar: avatar || '📢',
                creatorId,
                lastMessageId: null,
            },
        });

        await prisma.channelMember.create({
            data: {
                channelId: newChannel.id,
                userId: creatorId,
                role: 'admin'
            }
        });

        res.status(201).json(newChannel);
    } catch (error) {
        console.error('Ошибка создания канала:', error);
        res.status(500).json({ error: 'Не удалось создать канал' });
    }
};

// --- PUT /api/channels/:channelId ---
const updateChannel = async (req, res) => {
    try {
        const channelId = parseInt(req.params.channelId);
        const userId = req.userId;
        const { name } = req.body;

        const channel = await prisma.channel.findUnique({ where: { id: channelId } });
        if (!channel) {
            return res.status(404).json({ error: 'Канал не найден' });
        }

        const isAdmin = await prisma.channelMember.findFirst({
            where: { channelId, userId, role: 'admin' }
        });
        if (channel.creatorId !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Только создатель или админ может изменять канал' });
        }

        let avatar = channel.avatar;
        if (req.file) {
            if (avatar && avatar.startsWith('/uploads/')) {
                const oldPath = path.join(__dirname, '../../public', avatar);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            avatar = '/uploads/' + req.file.filename;
        }

        const updatedChannel = await prisma.channel.update({
            where: { id: channelId },
            data: {
                name: name !== undefined ? name.trim() : channel.name,
                avatar,
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { sender: { select: { id: true, username: true } } }
                }
            }
        });

        const lastMessage = updatedChannel.messages[0] || null;
        const { messages, ...channelData } = updatedChannel;
        const result = { ...channelData, lastMessage, type: 'channel' };

        const io = req.app.get('io');
        io.to(`channel_${channelId}`).emit('channel_updated', result);

        console.log(`✏️ Канал ${channelId} обновлён, событие разослано`);
        res.json(result);
    } catch (error) {
        console.error('Ошибка обновления канала:', error);
        res.status(500).json({ error: 'Не удалось обновить канал' });
    }
};

// --- DELETE /api/channels/:channelId ---
const deleteChannel = async (req, res) => {
    try {
        const channelId = parseInt(req.params.channelId);
        const userId = req.userId;

        console.log(`🗑️ [SERVER] Удаление канала ${channelId} пользователем ${userId}`);

        const channel = await prisma.channel.findUnique({
            where: { id: channelId }
        });
        if (!channel) {
            return res.status(404).json({ error: 'Канал не найден' });
        }
        if (channel.creatorId !== userId) {
            return res.status(403).json({ error: 'Только создатель может удалить канал' });
        }

        await prisma.channelMember.deleteMany({
            where: { channelId }
        });

        await prisma.channel.delete({
            where: { id: channelId }
        });

        const io = req.app.get('io');
        io.emit('channel_deleted', { channelId });

        console.log(`🗑️ Канал ${channelId} удалён, событие разослано`);
        res.json({ success: true, message: 'Канал удален' });
    } catch (error) {
        console.error('Ошибка удаления канала:', error);
        res.status(500).json({ error: 'Не удалось удалить канал', details: error.message });
    }
};

// --- GET /api/channels/:channelId/members ---
const getChannelMembers = async (req, res) => {
    try {
        const channelId = parseInt(req.params.channelId);
        const members = await prisma.channelMember.findMany({
            where: { channelId },
            include: {
                user: {
                    select: { id: true, username: true, avatar: true }
                }
            }
        });
        res.json(members);
    } catch (error) {
        console.error('Ошибка получения участников канала:', error);
        res.status(500).json({ error: 'Не удалось получить участников' });
    }
};

// --- ADD MEMBER ---
const addChannelMember = async (req, res) => {
    try {
        const channelId = parseInt(req.params.channelId);
        const { userId } = req.body;
        const currentUserId = req.userId;

        const channel = await prisma.channel.findUnique({ where: { id: channelId } });
        if (!channel) {
            return res.status(404).json({ error: 'Канал не найден' });
        }

        const isAdmin = await prisma.channelMember.findFirst({
            where: { channelId, userId: currentUserId, role: 'admin' }
        });
        if (!isAdmin) {
            return res.status(403).json({ error: 'Только админ может добавлять участников' });
        }

        const existing = await prisma.channelMember.findUnique({
            where: { channelId_userId: { channelId, userId } }
        });
        if (existing) {
            return res.status(400).json({ error: 'Пользователь уже участник канала' });
        }

        const member = await prisma.channelMember.create({
            data: { channelId, userId, role: 'member' },
            include: { user: { select: { id: true, username: true, avatar: true } } }
        });

        try {
            const io = req.app.get('io');
            const roomName = `channel_${channelId}`;
            io.to(roomName).emit('channel_member_added', {
                channelId,
                member,
                channelName: channel.name
            });

            const newUserSocketId = onlineUsers.get(userId);
            if (newUserSocketId) {
                const fullChannel = await prisma.channel.findUnique({
                    where: { id: channelId },
                    include: {
                        messages: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            include: { sender: { select: { id: true, username: true } } }
                        }
                    }
                });
                const lastMessage = fullChannel.messages[0] || null;
                const { messages, ...channelData } = fullChannel;
                io.to(newUserSocketId).emit('channel_created', {
                    ...channelData,
                    lastMessage,
                    members: [member]
                });
                const socket = io.sockets.sockets.get(newUserSocketId);
                if (socket) socket.join(roomName);
            }
        } catch (socketError) {
            console.error('❌ Ошибка отправки сокет-события при добавлении участника в канал:', socketError);
        }

        res.status(201).json(member);
    } catch (error) {
        console.error('Ошибка добавления участника в канал:', error);
        res.status(500).json({ error: 'Не удалось добавить участника', details: error.message });
    }
};

// --- REMOVE MEMBER ---
const removeChannelMember = async (req, res) => {
    try {
        const channelId = parseInt(req.params.channelId);
        const userId = parseInt(req.params.userId);
        const currentUserId = req.userId;

        console.log(`🗑️ [SERVER] Удаление пользователя ${userId} из канала ${channelId}`);

        const channel = await prisma.channel.findUnique({
            where: { id: channelId }
        });
        if (!channel) {
            return res.status(404).json({ error: 'Канал не найден' });
        }

        if (userId === currentUserId) {
            if (userId === channel.creatorId) {
                return res.status(400).json({ error: 'Создатель не может покинуть канал' });
            }
            const member = await prisma.channelMember.findUnique({
                where: { channelId_userId: { channelId, userId } }
            });
            if (!member) {
                return res.status(404).json({ error: 'Вы не участник канала' });
            }
            await prisma.channelMember.delete({
                where: { channelId_userId: { channelId, userId } }
            });
            const io = req.app.get('io');
            io.to(`channel_${channelId}`).emit('channel_member_removed', {
                channelId,
                userId,
                channelName: channel.name
            });
            const removedSocketId = onlineUsers.get(userId);
            if (removedSocketId) {
                io.to(removedSocketId).emit('kicked_from_channel', {
                    channelId,
                    channelName: channel.name
                });
                const socket = io.sockets.sockets.get(removedSocketId);
                if (socket) {
                    socket.leave(`channel_${channelId}`);
                    console.log(`🚪 Пользователь ${userId} покинул канал ${channelId}`);
                }
            }
            return res.json({ success: true, message: 'Вы покинули канал' });
        }

        const isAdmin = await prisma.channelMember.findFirst({
            where: { channelId, userId: currentUserId, role: 'admin' }
        });
        if (!isAdmin) {
            return res.status(403).json({ error: 'Только админ может удалять участников' });
        }

        if (userId === channel.creatorId) {
            return res.status(400).json({ error: 'Нельзя удалить создателя канала' });
        }

        const member = await prisma.channelMember.findUnique({
            where: { channelId_userId: { channelId, userId } }
        });
        if (!member) {
            return res.status(404).json({ error: 'Участник не найден' });
        }

        await prisma.channelMember.delete({
            where: { channelId_userId: { channelId, userId } }
        });

        const io = req.app.get('io');
        io.to(`channel_${channelId}`).emit('channel_member_removed', {
            channelId,
            userId,
            channelName: channel.name
        });

        res.json({ success: true, message: 'Участник удален из канала' });
    } catch (error) {
        console.error('Ошибка удаления участника из канала:', error);
        res.status(500).json({ error: 'Не удалось удалить участника', details: error.message });
    }
};

// ==============================================
// ЗАЯВКИ НА ВСТУПЛЕНИЕ В КАНАЛ
// ==============================================
const searchChannels = async (req, res) => {
    try {
        console.log('🔍 1. Функция searchChannels вызвана!');
        const { query } = req.query;
        const userId = req.userId;
        
        console.log(`🔍 2. query: "${query}", userId: ${userId}`);

        if (!query || query.length < 2) {
            console.log('🔍 3. Запрос слишком короткий');
            return res.status(400).json({ error: 'Минимум 2 символа' });
        }

        console.log('🔍 4. Начинаю поиск в БД...');
        const channels = await prisma.channel.findMany({
            where: {
                name: { 
                    contains: query,
                    mode: 'insensitive'
                }
            },
            include: {
                members: {
                    where: { userId },
                    select: { userId: true, role: true }
                }
            },
            take: 20
        });

        console.log(`🔍 5. Найдено каналов: ${channels.length}`);

        const result = channels.map(channel => {
            const isMember = channel.members.some(m => m.userId === userId);
            const isAdmin = channel.members.some(m => m.userId === userId && m.role === 'admin');
            const { members, ...channelData } = channel;
            
            return {
                ...channelData,
                isMember,
                isAdmin,
                memberCount: channel.members.length,
                lastMessage: null
            };
        });

        console.log('🔍 6. Отправляю результат:', result.length, 'каналов');
        res.json(result);
    } catch (error) {
        console.error('❌ ОШИБКА в searchChannels:', error);
        console.error('❌ Стек ошибки:', error.stack);
        res.status(500).json({ 
            error: 'Не удалось найти каналы',
            details: error.message,
            stack: error.stack
        });
    }
};

// --- ПОДАТЬ ЗАЯВКУ ---
const createJoinRequest = async (req, res) => {
    try {
        const channelId = parseInt(req.params.channelId);
        const userId = req.userId;

        const channel = await prisma.channel.findUnique({
            where: { id: channelId }
        });
        if (!channel) {
            return res.status(404).json({ error: 'Канал не найден' });
        }

        const existingMember = await prisma.channelMember.findUnique({
            where: { channelId_userId: { channelId, userId } }
        });
        if (existingMember) {
            return res.status(400).json({ error: 'Вы уже участник канала' });
        }

        // ✅ НОВАЯ ПРОВЕРКА: ищем последнюю заявку
        const existingRequest = await prisma.joinRequest.findUnique({
            where: { channelId_userId: { channelId, userId } }
        });

        if (existingRequest) {
            // Если заявка уже одобрена
            if (existingRequest.status === 'approved') {
                return res.status(400).json({ error: 'Вы уже участник канала' });
            }
            
            // Если заявка отклонена — проверяем время
            if (existingRequest.status === 'rejected') {
                const now = new Date();
                const createdAt = new Date(existingRequest.createdAt);
                const diffMinutes = (now - createdAt) / (1000 * 60);
                
                if (diffMinutes < 5) {
                    const remainingMinutes = Math.ceil(5 - diffMinutes);
                    return res.status(400).json({ 
                        error: `Заявка отклонена. Повторно подать можно через ${remainingMinutes} мин.`,
                        canRetryAfter: 5 - diffMinutes,
                        status: 'rejected'
                    });
                }
                
                // ✅ Прошло 5 минут — удаляем старую заявку и создаём новую
                await prisma.joinRequest.delete({
                    where: { id: existingRequest.id }
                });
                // Продолжаем создание новой заявки
            }
            
            // Если заявка в статусе pending
            if (existingRequest.status === 'pending') {
                return res.status(400).json({ 
                    error: 'Заявка уже отправлена и ожидает рассмотрения',
                    status: 'pending'
                });
            }
        }

        // Создаём новую заявку
        const joinRequest = await prisma.joinRequest.create({
            data: {
                channelId,
                userId,
                status: 'pending'
            },
            include: {
                user: {
                    select: { id: true, username: true, avatar: true }
                }
            }
        });

        // Отправляем уведомление админам
        const io = req.app.get('io');
        const admins = await prisma.channelMember.findMany({
            where: {
                channelId,
                role: 'admin'
            },
            select: { userId: true }
        });

        for (const admin of admins) {
            const socketId = onlineUsers.get(admin.userId);
            if (socketId) {
                io.to(socketId).emit('join_request_received', {
                    channelId,
                    channelName: channel.name,
                    request: joinRequest
                });
            }
        }

        res.status(201).json(joinRequest);
    } catch (error) {
        console.error('❌ Ошибка создания заявки:', error);
        res.status(500).json({ error: 'Не удалось отправить заявку' });
    }
};

// --- ПОЛУЧИТЬ ЗАЯВКИ ---
const getJoinRequests = async (req, res) => {
    try {
        const channelId = parseInt(req.params.channelId);
        const userId = req.userId;

        const isAdmin = await prisma.channelMember.findFirst({
            where: { channelId, userId, role: 'admin' }
        });
        if (!isAdmin) {
            return res.status(403).json({ error: 'Только администраторы могут просматривать заявки' });
        }

        const requests = await prisma.joinRequest.findMany({
            where: {
                channelId,
                status: 'pending'
            },
            include: {
                user: {
                    select: { id: true, username: true, avatar: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(requests);
    } catch (error) {
        console.error('❌ Ошибка получения заявок:', error);
        res.status(500).json({ error: 'Не удалось получить заявки' });
    }
};

// --- ОДОБРИТЬ ЗАЯВКУ ---
const approveJoinRequest = async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const userId = req.userId;

        const request = await prisma.joinRequest.findUnique({
            where: { id: requestId },
            include: { channel: true }
        });
        if (!request) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        const isAdmin = await prisma.channelMember.findFirst({
            where: { channelId: request.channelId, userId, role: 'admin' }
        });
        if (!isAdmin) {
            return res.status(403).json({ error: 'Только администраторы могут одобрять заявки' });
        }

        await prisma.channelMember.create({
            data: {
                channelId: request.channelId,
                userId: request.userId,
                role: 'member'
            }
        });

        const updatedRequest = await prisma.joinRequest.update({
            where: { id: requestId },
            data: { status: 'approved' }
        });

        const io = req.app.get('io');
        const socketId = onlineUsers.get(request.userId);
        if (socketId) {
            io.to(socketId).emit('join_request_approved', {
                channelId: request.channelId,
                channelName: request.channel.name
            });
        }

        res.json({ success: true, request: updatedRequest });
    } catch (error) {
        console.error('❌ Ошибка одобрения заявки:', error);
        res.status(500).json({ error: 'Не удалось одобрить заявку' });
    }
};

// --- ОТКЛОНИТЬ ЗАЯВКУ ---
const rejectJoinRequest = async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const userId = req.userId;

        const request = await prisma.joinRequest.findUnique({
            where: { id: requestId },
            include: { channel: true }
        });
        if (!request) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        const isAdmin = await prisma.channelMember.findFirst({
            where: { channelId: request.channelId, userId, role: 'admin' }
        });
        if (!isAdmin) {
            return res.status(403).json({ error: 'Только администраторы могут отклонять заявки' });
        }

        const updatedRequest = await prisma.joinRequest.update({
            where: { id: requestId },
            data: { status: 'rejected' }
        });

        const io = req.app.get('io');
        const socketId = onlineUsers.get(request.userId);
        if (socketId) {
            io.to(socketId).emit('join_request_rejected', {
                channelId: request.channelId,
                channelName: request.channel.name
            });
        }

        res.json({ success: true, request: updatedRequest });
    } catch (error) {
        console.error('❌ Ошибка отклонения заявки:', error);
        res.status(500).json({ error: 'Не удалось отклонить заявку' });
    }
};

// --- ОТМЕНИТЬ ЗАЯВКУ ---
const cancelJoinRequest = async (req, res) => {
    try {
        const channelId = parseInt(req.params.channelId);
        const userId = req.userId;

        const request = await prisma.joinRequest.findUnique({
            where: { channelId_userId: { channelId, userId } }
        });
        if (!request) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Заявка уже обработана' });
        }

        await prisma.joinRequest.delete({
            where: { id: request.id }
        });

        res.json({ success: true, message: 'Заявка отменена' });
    } catch (error) {
        console.error('❌ Ошибка отмены заявки:', error);
        res.status(500).json({ error: 'Не удалось отменить заявку' });
    }
};
console.log('✅ channelController экспортирует:');
console.log('  - approveJoinRequest:', typeof approveJoinRequest);
console.log('  - rejectJoinRequest:', typeof rejectJoinRequest);
module.exports = {
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
};