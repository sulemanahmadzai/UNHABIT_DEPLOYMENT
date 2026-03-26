import redis from "../db/redis.js";
/**
 * Cache-aside pattern: Try cache first, fallback to function, then cache result
 */
export async function cacheAside(key, fetchFn, options = {}) {
    const { ttl = 300, prefix = "cache" } = options;
    const fullKey = `${prefix}:${key}`;
    // Try to get from cache
    const cached = await redis.get(fullKey);
    if (cached !== null) {
        return cached;
    }
    // Cache miss - fetch data
    const data = await fetchFn();
    // Store in cache (fire and forget)
    redis.set(fullKey, data, ttl).catch((err) => {
        console.error(`Failed to cache key ${fullKey}:`, err);
    });
    return data;
}
/**
 * Invalidate cache by key
 */
export async function invalidate(key, prefix = "cache") {
    const fullKey = `${prefix}:${key}`;
    await redis.del(fullKey);
}
/**
 * Invalidate multiple cache keys by pattern
 */
export async function invalidatePattern(pattern, prefix = "cache") {
    const fullPattern = `${prefix}:${pattern}`;
    return redis.delPattern(fullPattern);
}
/**
 * Cache user profile data
 */
export async function cacheUserProfile(userId, profile, ttl = 600) {
    await redis.set(`profile:${userId}`, profile, ttl);
}
/**
 * Get cached user profile
 */
export async function getCachedUserProfile(userId) {
    return redis.get(`profile:${userId}`);
}
/**
 * Invalidate user profile cache
 */
export async function invalidateUserProfile(userId) {
    await redis.del(`profile:${userId}`);
}
/**
 * Cache dashboard data
 */
export async function cacheDashboard(userId, data, ttl = 120) {
    await redis.set(`dashboard:${userId}`, data, ttl);
}
/**
 * Get cached dashboard
 */
export async function getCachedDashboard(userId) {
    return redis.get(`dashboard:${userId}`);
}
/**
 * Invalidate dashboard cache
 */
export async function invalidateDashboard(userId) {
    await redis.del(`dashboard:${userId}`);
}
/**
 * Cache leaderboard data
 */
export async function cacheLeaderboard(type, userId, data, ttl = 300) {
    await redis.set(`leaderboard:${type}:${userId}`, data, ttl);
}
/**
 * Get cached leaderboard
 */
export async function getCachedLeaderboard(type, userId) {
    return redis.get(`leaderboard:${type}:${userId}`);
}
/**
 * Invalidate all leaderboards
 */
export async function invalidateAllLeaderboards() {
    await redis.delPattern("leaderboard:*");
}
/**
 * Cache AI response
 */
export async function cacheAIResponse(endpoint, requestHash, response, ttl = 86400 // 24 hours
) {
    const key = `ai:${endpoint}:${requestHash}`;
    await redis.set(key, response, ttl);
}
/**
 * Get cached AI response
 */
export async function getCachedAIResponse(endpoint, requestHash) {
    const key = `ai:${endpoint}:${requestHash}`;
    return redis.get(key);
}
/**
 * Cache analytics data
 */
export async function cacheAnalytics(userId, type, data, ttl = 600) {
    await redis.set(`analytics:${userId}:${type}`, data, ttl);
}
/**
 * Get cached analytics
 */
export async function getCachedAnalytics(userId, type) {
    return redis.get(`analytics:${userId}:${type}`);
}
/**
 * Invalidate user's analytics cache
 */
export async function invalidateUserAnalytics(userId) {
    await redis.delPattern(`analytics:${userId}:*`);
}
//# sourceMappingURL=cache.service.js.map