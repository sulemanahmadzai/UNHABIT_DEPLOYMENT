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
    isNew: boolean;
    data?: T;
}
/**
 * Check idempotency and store result
 *
 * @param key - Unique idempotency key
 * @param operation - Function to execute if key is new
 * @param ttlSeconds - How long to remember this operation (default 24h)
 * @returns Result with isNew flag and cached data if available
 */
export declare function withIdempotency<T>(key: string, operation: () => Promise<T>, ttlSeconds?: number): Promise<IdempotencyResult<T>>;
/**
 * Check if an idempotency key exists
 */
export declare function checkIdempotency(key: string): Promise<boolean>;
/**
 * Get cached result for an idempotency key
 */
export declare function getIdempotentResult<T>(key: string): Promise<T | null>;
/**
 * Store idempotency result
 */
export declare function storeIdempotentResult<T>(key: string, data: T, ttlSeconds?: number): Promise<void>;
/**
 * Clear idempotency key (admin function)
 */
export declare function clearIdempotency(key: string): Promise<void>;
/**
 * Generate idempotency key for AI requests
 */
export declare function generateAIIdempotencyKey(userId: string, endpoint: string, requestData: any): string;
/**
 * Generate idempotency key for point awards
 */
export declare function generatePointIdempotencyKey(userId: string, eventType: string, eventId: string): string;
/**
 * Generate idempotency key for badge awards
 */
export declare function generateBadgeIdempotencyKey(userId: string, badgeId: string): string;
//# sourceMappingURL=idempotency.service.d.ts.map