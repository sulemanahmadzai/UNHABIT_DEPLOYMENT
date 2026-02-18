import redis from "../db/redis.js";

/**
 * Idempotency Service - Prevent duplicate operations
 * 
 * Uses Redis to track idempotency keys and prevent duplicate:
 * - AI requests (expensive)
 * - Point awards
 * - Badge grants
 * - Payment operations
 */

export interface IdempotencyResult<T = any> {
  isNew: boolean; // True if this is a new operation
  data?: T; // Cached result if operation was already performed
}

/**
 * Check idempotency and store result
 * 
 * @param key - Unique idempotency key
 * @param operation - Function to execute if key is new
 * @param ttlSeconds - How long to remember this operation (default 24h)
 * @returns Result with isNew flag and cached data if available
 */
export async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>,
  ttlSeconds = 86400
): Promise<IdempotencyResult<T>> {
  const idempotencyKey = `idempotency:${key}`;

  // If Redis unavailable, always execute (no idempotency protection)
  if (!redis.isAvailable()) {
    const data = await operation();
    return { isNew: true, data };
  }

  try {
    // Check if operation was already performed
    const cached = await redis.get<T>(idempotencyKey);
    if (cached !== null) {
      return { isNew: false, data: cached };
    }

    // Execute operation
    const data = await operation();

    // Store result
    await redis.set(idempotencyKey, data, ttlSeconds);

    return { isNew: true, data };
  } catch (error) {
    console.error(`Idempotency check failed for ${key}:`, error);
    // On error, execute operation (fail open)
    const data = await operation();
    return { isNew: true, data };
  }
}

/**
 * Check if an idempotency key exists
 */
export async function checkIdempotency(key: string): Promise<boolean> {
  const idempotencyKey = `idempotency:${key}`;
  return redis.exists(idempotencyKey);
}

/**
 * Get cached result for an idempotency key
 */
export async function getIdempotentResult<T>(key: string): Promise<T | null> {
  const idempotencyKey = `idempotency:${key}`;
  return redis.get<T>(idempotencyKey);
}

/**
 * Store idempotency result
 */
export async function storeIdempotentResult<T>(
  key: string,
  data: T,
  ttlSeconds = 86400
): Promise<void> {
  const idempotencyKey = `idempotency:${key}`;
  await redis.set(idempotencyKey, data, ttlSeconds);
}

/**
 * Clear idempotency key (admin function)
 */
export async function clearIdempotency(key: string): Promise<void> {
  const idempotencyKey = `idempotency:${key}`;
  await redis.del(idempotencyKey);
}

/**
 * Generate idempotency key for AI requests
 */
export function generateAIIdempotencyKey(
  userId: string,
  endpoint: string,
  requestData: any
): string {
  const hash = redis.hash(requestData);
  return `ai:${userId}:${endpoint}:${hash}`;
}

/**
 * Generate idempotency key for point awards
 */
export function generatePointIdempotencyKey(
  userId: string,
  eventType: string,
  eventId: string
): string {
  return `points:${userId}:${eventType}:${eventId}`;
}

/**
 * Generate idempotency key for badge awards
 */
export function generateBadgeIdempotencyKey(userId: string, badgeId: string): string {
  return `badge:${userId}:${badgeId}`;
}
