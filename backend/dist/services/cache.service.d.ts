/**
 * Cache Service - High-level caching patterns
 *
 * Provides:
 * - Cache-aside pattern with automatic fallback
 * - Cache warming
 * - Cache invalidation patterns
 * - TTL management
 */
export interface CacheOptions {
    ttl?: number;
    prefix?: string;
}
/**
 * Cache-aside pattern: Try cache first, fallback to function, then cache result
 */
export declare function cacheAside<T>(key: string, fetchFn: () => Promise<T>, options?: CacheOptions): Promise<T>;
/**
 * Invalidate cache by key
 */
export declare function invalidate(key: string, prefix?: string): Promise<void>;
/**
 * Invalidate multiple cache keys by pattern
 */
export declare function invalidatePattern(pattern: string, prefix?: string): Promise<number>;
/**
 * Cache user profile data
 */
export declare function cacheUserProfile(userId: string, profile: any, ttl?: number): Promise<void>;
/**
 * Get cached user profile
 */
export declare function getCachedUserProfile(userId: string): Promise<any | null>;
/**
 * Invalidate user profile cache
 */
export declare function invalidateUserProfile(userId: string): Promise<void>;
/**
 * Cache dashboard data
 */
export declare function cacheDashboard(userId: string, data: any, ttl?: number): Promise<void>;
/**
 * Get cached dashboard
 */
export declare function getCachedDashboard(userId: string): Promise<any | null>;
/**
 * Invalidate dashboard cache
 */
export declare function invalidateDashboard(userId: string): Promise<void>;
/**
 * Cache leaderboard data
 */
export declare function cacheLeaderboard(type: "daily" | "weekly" | "friends", userId: string, data: any, ttl?: number): Promise<void>;
/**
 * Get cached leaderboard
 */
export declare function getCachedLeaderboard(type: "daily" | "weekly" | "friends", userId: string): Promise<any | null>;
/**
 * Invalidate all leaderboards
 */
export declare function invalidateAllLeaderboards(): Promise<void>;
/**
 * Cache AI response
 */
export declare function cacheAIResponse(endpoint: string, requestHash: string, response: any, ttl?: number): Promise<void>;
/**
 * Get cached AI response
 */
export declare function getCachedAIResponse(endpoint: string, requestHash: string): Promise<any | null>;
/**
 * Cache analytics data
 */
export declare function cacheAnalytics(userId: string, type: string, data: any, ttl?: number): Promise<void>;
/**
 * Get cached analytics
 */
export declare function getCachedAnalytics(userId: string, type: string): Promise<any | null>;
/**
 * Invalidate user's analytics cache
 */
export declare function invalidateUserAnalytics(userId: string): Promise<void>;
//# sourceMappingURL=cache.service.d.ts.map