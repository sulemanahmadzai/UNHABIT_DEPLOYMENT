import redis from "../db/redis.js";

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
  ttl?: number; // TTL in seconds
  prefix?: string; // Key prefix for namespacing
}

/**
 * Cache-aside pattern: Try cache first, fallback to function, then cache result
 */
export async function cacheAside<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 300, prefix = "cache" } = options;
  const fullKey = `${prefix}:${key}`;

  // Try to get from cache
  const cached = await redis.get<T>(fullKey);
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
export async function invalidate(key: string, prefix = "cache"): Promise<void> {
  const fullKey = `${prefix}:${key}`;
  await redis.del(fullKey);
}

/**
 * Invalidate multiple cache keys by pattern
 */
export async function invalidatePattern(pattern: string, prefix = "cache"): Promise<number> {
  const fullPattern = `${prefix}:${pattern}`;
  return redis.delPattern(fullPattern);
}

/**
 * Cache user profile data
 */
export async function cacheUserProfile(userId: string, profile: any, ttl = 600): Promise<void> {
  await redis.set(`profile:${userId}`, profile, ttl);
}

/**
 * Get cached user profile
 */
export async function getCachedUserProfile(userId: string): Promise<any | null> {
  return redis.get(`profile:${userId}`);
}

/**
 * Invalidate user profile cache
 */
export async function invalidateUserProfile(userId: string): Promise<void> {
  await redis.del(`profile:${userId}`);
}

/**
 * Cache dashboard data
 */
export async function cacheDashboard(userId: string, data: any, ttl = 120): Promise<void> {
  await redis.set(`dashboard:${userId}`, data, ttl);
}

/**
 * Get cached dashboard
 */
export async function getCachedDashboard(userId: string): Promise<any | null> {
  return redis.get(`dashboard:${userId}`);
}

/**
 * Invalidate dashboard cache
 */
export async function invalidateDashboard(userId: string): Promise<void> {
  await redis.del(`dashboard:${userId}`);
}

/**
 * Cache leaderboard data
 */
export async function cacheLeaderboard(
  type: "daily" | "weekly" | "friends",
  userId: string,
  data: any,
  ttl = 300
): Promise<void> {
  await redis.set(`leaderboard:${type}:${userId}`, data, ttl);
}

/**
 * Get cached leaderboard
 */
export async function getCachedLeaderboard(
  type: "daily" | "weekly" | "friends",
  userId: string
): Promise<any | null> {
  return redis.get(`leaderboard:${type}:${userId}`);
}

/**
 * Invalidate all leaderboards
 */
export async function invalidateAllLeaderboards(): Promise<void> {
  await redis.delPattern("leaderboard:*");
}

/**
 * Cache AI response
 */
export async function cacheAIResponse(
  endpoint: string,
  requestHash: string,
  response: any,
  ttl = 86400 // 24 hours
): Promise<void> {
  const key = `ai:${endpoint}:${requestHash}`;
  await redis.set(key, response, ttl);
}

/**
 * Get cached AI response
 */
export async function getCachedAIResponse(
  endpoint: string,
  requestHash: string
): Promise<any | null> {
  const key = `ai:${endpoint}:${requestHash}`;
  return redis.get(key);
}

/**
 * Cache analytics data
 */
export async function cacheAnalytics(
  userId: string,
  type: string,
  data: any,
  ttl = 600
): Promise<void> {
  await redis.set(`analytics:${userId}:${type}`, data, ttl);
}

/**
 * Get cached analytics
 */
export async function getCachedAnalytics(userId: string, type: string): Promise<any | null> {
  return redis.get(`analytics:${userId}:${type}`);
}

/**
 * Invalidate user's analytics cache
 */
export async function invalidateUserAnalytics(userId: string): Promise<void> {
  await redis.delPattern(`analytics:${userId}:*`);
}

/**
 * Cache badge gallery data (computed per user, short TTL to balance freshness/speed)
 */
export async function cacheBadgeGallery(userId: string, data: any, ttl = 60): Promise<void> {
  await redis.set(`badge_gallery:${userId}`, data, ttl);
}

/**
 * Get cached badge gallery
 */
export async function getCachedBadgeGallery(userId: string): Promise<any | null> {
  return redis.get(`badge_gallery:${userId}`);
}

/**
 * Invalidate badge gallery cache (call after earning a badge or completing tasks)
 */
export async function invalidateBadgeGallery(userId: string): Promise<void> {
  await redis.del(`badge_gallery:${userId}`);
}

/**
 * Cache level/XP info (changes only when points are awarded)
 */
export async function cacheLevelInfo(userId: string, data: any, ttl = 120): Promise<void> {
  await redis.set(`level_info:${userId}`, data, ttl);
}

/**
 * Get cached level info
 */
export async function getCachedLevelInfo(userId: string): Promise<any | null> {
  return redis.get(`level_info:${userId}`);
}

/**
 * Invalidate level info cache (call after awarding points)
 */
export async function invalidateLevelInfo(userId: string): Promise<void> {
  await redis.del(`level_info:${userId}`);
}
