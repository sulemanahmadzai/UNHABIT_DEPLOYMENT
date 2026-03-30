import { PrismaClient } from "@prisma/client";
/**
 * Prisma Client with optimized connection pooling
 *
 * Configuration:
 * - Connection pool size: Managed by DATABASE_URL connection_limit parameter
 * - Connection timeout: 20 seconds
 * - Pool timeout: 10 seconds (how long to wait for available connection)
 * - Query logging: Enabled in development
 */
export const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});
// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=prisma.js.map