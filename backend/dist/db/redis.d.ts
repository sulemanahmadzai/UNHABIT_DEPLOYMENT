import { Redis as RedisType } from "ioredis";
/**
 * Redis Service - Centralized Redis client with connection management
 *
 * Features:
 * - Connection pooling and retry logic
 * - Graceful degradation (app continues if Redis fails)
 * - Structured logging
 * - Helper methods for common patterns
 */
declare class RedisService {
    private client;
    private isConnected;
    private isEnabled;
    constructor();
    private initialize;
    /**
     * Check if Redis is available
     */
    isAvailable(): boolean;
    /**
     * Get the Redis client (use with caution, prefer helper methods)
     */
    getClient(): RedisType | null;
    /**
     * Get a value from cache
     */
    get<T = string>(key: string): Promise<T | null>;
    /**
     * Set a value in cache with optional TTL
     */
    set(key: string, value: any, ttlSeconds?: number): Promise<boolean>;
    /**
     * Delete a key or keys
     */
    del(...keys: string[]): Promise<boolean>;
    /**
     * Delete keys matching a pattern
     */
    delPattern(pattern: string): Promise<number>;
    /**
     * Check if a key exists
     */
    exists(key: string): Promise<boolean>;
    /**
     * Increment a counter
     */
    incr(key: string, ttlSeconds?: number): Promise<number>;
    /**
     * Get TTL of a key
     */
    ttl(key: string): Promise<number>;
    /**
     * Set expiration on a key
     */
    expire(key: string, seconds: number): Promise<boolean>;
    /**
     * Hash a value for deterministic cache keys.
     *
     * IMPORTANT: object keys are sorted recursively before stringifying so that
     *   { a: 1, b: 2 }   and   { b: 2, a: 1 }
     * produce the SAME hash. Previously this used plain JSON.stringify, which
     * meant any whitespace difference or key reordering caused cache misses on
     * payloads that were semantically identical (e.g. for /plan-21d this could
     * make two equivalent requests miss the cache and re-trigger an expensive
     * LLM call).
     */
    hash(value: any): string;
    /**
     * Graceful shutdown
     */
    disconnect(): Promise<void>;
}
declare const redis: RedisService;
export default redis;
export { RedisService };
//# sourceMappingURL=redis.d.ts.map