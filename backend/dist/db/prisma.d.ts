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
export declare const prisma: PrismaClient<{
    log: ("warn" | "error")[];
}, "warn" | "error", import("@prisma/client/runtime/library").DefaultArgs>;
//# sourceMappingURL=prisma.d.ts.map