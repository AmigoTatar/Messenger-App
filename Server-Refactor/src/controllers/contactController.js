const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { onlineUsers } = require('../socket/socketHandlers'); // ← ДОБАВИТЬ

// ==============================================
// ПОЛУЧИТЬ СПИСОК КОНТАКТОВ
// ==============================================
const getContacts = async (req, res) => {
    try {
        const userId = req.userId;

        const contacts = await prisma.contact.findMany({
            where: { userId },
            include: {
                contact: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true,
                        email: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // ✅ Добавляем последнее сообщение для каждого контакта
        const contactsWithLastMessage = await Promise.all(
            contacts.map(async (c) => {
                const lastMessage = await prisma.message.findFirst({
                    where: {
                        OR: [
                            { senderId: userId, receiverId: c.contact.id },
                            { senderId: c.contact.id, receiverId: userId }
                        ],
                        channelId: null,
                        chatId: null
                    },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        sender: { select: { id: true, username: true } }
                    }
                });
                return {
                    ...c.contact,
                    lastMessage: lastMessage || null
                };
            })
        );

        res.json(contactsWithLastMessage);
    } catch (error) {
        console.error('❌ Ошибка получения контактов:', error);
        res.status(500).json({ error: 'Не удалось загрузить контакты' });
    }
};

// ==============================================
// ДОБАВИТЬ КОНТАКТ (ВЗАИМНО)
// ==============================================
const addContact = async (req, res) => {
    try {
        const userId = req.userId;
        const { contactId } = req.body;

        if (!contactId) {
            return res.status(400).json({ error: 'Не указан contactId' });
        }

        const contactIdNum = Number(contactId);
        if (isNaN(contactIdNum)) {
            return res.status(400).json({ error: 'Неверный ID' });
        }

        if (contactIdNum === userId) {
            return res.status(400).json({ error: 'Нельзя добавить самого себя' });
        }

        const contactUser = await prisma.user.findUnique({
            where: { id: contactIdNum }
        });

        if (!contactUser) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const existing = await prisma.contact.findUnique({
            where: {
                userId_contactId: {
                    userId,
                    contactId: contactIdNum
                }
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Контакт уже добавлен' });
        }

        // 1. Добавляем контакт
        const contact = await prisma.contact.create({
            data: {
                userId,
                contactId: contactIdNum
            },
            include: {
                contact: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true,
                        email: true,
                    }
                }
            }
        });

        // 2. Добавляем обратную связь
        await prisma.contact.upsert({
            where: {
                userId_contactId: {
                    userId: contactIdNum,
                    contactId: userId
                }
            },
            update: {},
            create: {
                userId: contactIdNum,
                contactId: userId
            }
        });

        // 3. Отправляем событие через сокет
        try {
            const io = req.app.get('io');
            const targetSocketId = onlineUsers.get(contactIdNum);
            if (targetSocketId && io) {
                const userData = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, username: true, avatar: true }
                });
                io.to(targetSocketId).emit('contact_added', userData);
                console.log(`📤 Событие contact_added отправлено пользователю ${contactIdNum}`);
            }
        } catch (socketError) {
            console.error('⚠️ Ошибка отправки сокет-события:', socketError);
            // Не прерываем выполнение, если сокет не работает
        }

        res.status(201).json(contact.contact);
    } catch (error) {
        console.error('❌ Ошибка добавления контакта:', error);
        res.status(500).json({ error: 'Не удалось добавить контакт' });
    }
};

// ==============================================
// УДАЛИТЬ КОНТАКТ
// ==============================================
const deleteContact = async (req, res) => {
    try {
        const userId = req.userId;
        const contactId = parseInt(req.params.contactId);

        if (isNaN(contactId)) {
            return res.status(400).json({ error: 'Неверный ID' });
        }

        const contact = await prisma.contact.findUnique({
            where: {
                userId_contactId: {
                    userId,
                    contactId
                }
            }
        });

        if (!contact) {
            return res.status(404).json({ error: 'Контакт не найден' });
        }

        await prisma.contact.delete({
            where: {
                userId_contactId: {
                    userId,
                    contactId
                }
            }
        });

        await prisma.contact.deleteMany({
            where: {
                userId: contactId,
                contactId: userId
            }
        });

        res.json({ success: true, message: 'Контакт удален' });
    } catch (error) {
        console.error('❌ Ошибка удаления контакта:', error);
        res.status(500).json({ error: 'Не удалось удалить контакт' });
    }
};

// ==============================================
// ПОИСК ПОЛЬЗОВАТЕЛЕЙ
// ==============================================
const searchUsers = async (req, res) => {
    try {
        const userId = req.userId;
        const { query } = req.query;

        console.log('🔍 [server] Поиск:', { userId, query });

        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Минимум 2 символа' });
        }

        const users = await prisma.user.findMany({
            where: {
                AND: [
                    { NOT: { id: userId } },
                    {
                        OR: [
                            { username: { contains: query } },
                            { email: { contains: query } }
                        ]
                    }
                ]
            },
            select: {
                id: true,
                username: true,
                avatar: true,
                email: true,
            },
            take: 20
        });

        const contactIds = await prisma.contact.findMany({
            where: { userId },
            select: { contactId: true }
        });

        const contactIdSet = new Set(contactIds.map(c => c.contactId));

        const result = users.map(user => ({
            ...user,
            isContact: contactIdSet.has(user.id)
        }));

        console.log('🔍 [server] Найдено пользователей:', result.length);
        res.json(result);
    } catch (error) {
        console.error('❌ Ошибка поиска пользователей:', error);
        res.status(500).json({ error: 'Не удалось выполнить поиск' });
    }
};

module.exports = {
    getContacts,
    addContact,
    deleteContact,
    searchUsers
};