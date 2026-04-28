import redis from "../db/redis.js";

/**
 * Rate Limiting Service - Sliding window rate limiter
 * 
 * Implements sliding window algorithm for accurate rate limiting
 * Gracefully degrades if Redis is unavailable (allows all requests)
 */

export interface RateLimitConfig {
  maxRequests: number; // Max requests allowed
  windowSeconds: number; // Time window in seconds
  blockDurationSeconds?: number; // How long to block after limit exceeded
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until can retry
}

/**
 * Check rate limit for a key (user ID, IP, etc.)
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowSeconds, blockDurationSeconds } = config;

  // If Redis unavailable, allow request (fail open)
  if (!redis.isAvailable()) {
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    };
  }

  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const rateLimitKey = `ratelimit:${key}`;
  const blockKey = `ratelimit:block:${key}`;

  try {
    // Check if currently blocked
    const isBlocked = await redis.exists(blockKey);
    if (isBlocked) {
      const ttl = await redis.ttl(blockKey);
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(now + ttl * 1000),
        retryAfter: ttl,
      };
    }

    // Use sorted set with timestamps as scores
    const client = redis.getClient();
    if (!client) {
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: new Date(now + windowSeconds * 1000),
      };
    }

    // Remove old entries outside the window
    await client.zremrangebyscore(rateLimitKey, 0, windowStart);

    // Count requests in current window
    const requestCount = await client.zcard(rateLimitKey);

    if (requestCount >= maxRequests) {
      // Rate limit exceeded
      if (blockDurationSeconds) {
        // Block the key for specified duration
        await redis.set(blockKey, "1", blockDurationSeconds);
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(now + windowSeconds * 1000),
        retryAfter: blockDurationSeconds || windowSeconds,
      };
    }

    // Add current request
    await client.zadd(rateLimitKey, now, `${now}-${Math.random()}`);

    // Set expiration on the sorted set
    await client.expire(rateLimitKey, windowSeconds);

    return {
      allowed: true,
      remaining: maxRequests - requestCount - 1,
      resetAt: new Date(now + windowSeconds * 1000),
    };
  } catch (error) {
    console.error(`Rate limit check failed for ${key}:`, error);
    // On error, allow request (fail open)
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: new Date(now + windowSeconds * 1000),
    };
  }
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // AI endpoints (expensive on cache miss, but cache hits are basically free).
  // Limits are intentionally generous: the backend uses Redis caching plus
  // stale-while-revalidate for /plan-21d, so most calls cost ~5ms not ~30s.
  // The previous 3/hour was so tight users were getting 429s during normal
  // retry behaviour, which the FE team flagged as "errors after a long wait".
  AI_ONBOARDING: { maxRequests: 15, windowSeconds: 3600 }, // 15 per hour
  AI_QUIZ: { maxRequests: 30, windowSeconds: 3600 }, // 30 per hour
  // Keep /plan-21d permissive because:
  // 1) cache hits are very cheap,
  // 2) we now return fast fallback <10s on miss,
  // 3) strict limits were causing frontend-visible 429s (false "errors").
  AI_PLAN: { maxRequests: 300, windowSeconds: 3600 }, // effectively 5/min per user
  AI_COACH: { maxRequests: 60, windowSeconds: 3600 }, // 60 per hour

  // Auth endpoints
  AUTH_LOGIN: { maxRequests: 5, windowSeconds: 300, blockDurationSeconds: 900 }, // 5 per 5min, block 15min
  AUTH_REGISTER: { maxRequests: 3, windowSeconds: 3600 }, // 3 per hour

  // General API
  API_GENERAL: { maxRequests: 100, windowSeconds: 60 }, // 100 per minute
  API_WRITE: { maxRequests: 30, windowSeconds: 60 }, // 30 writes per minute

  // IP-based (for unauthenticated endpoints)
  IP_GENERAL: { maxRequests: 50, windowSeconds: 60 }, // 50 per minute per IP
};

/**
 * Check rate limit for user
 */
export async function checkUserRateLimit(
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return checkRateLimit(`user:${userId}:${endpoint}`, config);
}

/**
 * Check rate limit for IP
 */
export async function checkIPRateLimit(
  ip: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return checkRateLimit(`ip:${ip}:${endpoint}`, config);
}

/**
 * Reset rate limit for a key (admin function)
 */
export async function resetRateLimit(key: string): Promise<void> {
  await redis.del(`ratelimit:${key}`, `ratelimit:block:${key}`);
}
