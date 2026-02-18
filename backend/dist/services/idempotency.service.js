import redis from "../db/redis.js";
/**
 * Check idempotency and store result
 *
 * @param key - Unique idempotency key
 * @param operation - Function to execute if key is new
 * @param ttlSeconds - How long to remember this operation (default 24h)
 * @returns Result with isNew flag and cached data if available
 */
export async function withIdempotency(key, operation, ttlSeconds = 86400) {
    const idempotencyKey = `idempotency:${key}`;
    // If Redis unavailable, always execute (no idempotency protection)
    if (!redis.isAvailable()) {
        const data = await operation();
        return { isNew: true, data };
    }
    try {
        // Check if operation was already performed
        const cached = await redis.get(idempotencyKey);
        if (cached !== null) {
            return { isNew: false, data: cached };
        }
        // Execute operation
        const data = await operation();
        // Store result
        await redis.set(idempotencyKey, data, ttlSeconds);
        return { isNew: true, data };
    }
    catch (error) {
        console.error(`Idempotency check failed for ${key}:`, error);
        // On error, execute operation (fail open)
        const data = await operation();
        return { isNew: true, data };
    }
}
/**
 * Check if an idempotency key exists
 */
export async function checkIdempotency(key) {
    const idempotencyKey = `idempotency:${key}`;
    return redis.exists(idempotencyKey);
}
/**
 * Get cached result for an idempotency key
 */
export async function getIdempotentResult(key) {
    const idempotencyKey = `idempotency:${key}`;
    return redis.get(idempotencyKey);
}
/**
 * Store idempotency result
 */
export async function storeIdempotentResult(key, data, ttlSeconds = 86400) {
    const idempotencyKey = `idempotency:${key}`;
    await redis.set(idempotencyKey, data, ttlSeconds);
}
/**
 * Clear idempotency key (admin function)
 */
export async function clearIdempotency(key) {
    const idempotencyKey = `idempotency:${key}`;
    await redis.del(idempotencyKey);
}
/**
 * Generate idempotency key for AI requests
 */
export function generateAIIdempotencyKey(userId, endpoint, requestData) {
    const hash = redis.hash(requestData);
    return `ai:${userId}:${endpoint}:${hash}`;
}
/**
 * Generate idempotency key for point awards
 */
export function generatePointIdempotencyKey(userId, eventType, eventId) {
    return `points:${userId}:${eventType}:${eventId}`;
}
/**
 * Generate idempotency key for badge awards
 */
export function generateBadgeIdempotencyKey(userId, badgeId) {
    return `badge:${userId}:${badgeId}`;
}
//# sourceMappingURL=idempotency.service.js.map