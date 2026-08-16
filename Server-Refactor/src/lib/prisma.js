const { PrismaClient } = require('@prisma/client');

// Один инстанс на процесс — иначе лишние пулы к PostgreSQL
const prisma = globalThis.__potokPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalThis.__potokPrisma = prisma;
}

module.exports = prisma;
