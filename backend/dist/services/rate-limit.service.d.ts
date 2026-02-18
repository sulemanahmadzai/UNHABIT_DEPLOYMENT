/**
 * Rate Limiting Service - Sliding window rate limiter
 *
 * Implements sliding window algorithm for accurate rate limiting
 * Gracefully degrades if Redis is unavailable (allows all requests)
 */
export interface RateLimitConfig {
    maxRequests: number;
    windowSeconds: number;
    blockDurationSeconds?: number;
}
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter?: number;
}
/**
 * Check rate limit for a key (user ID, IP, etc.)
 */
export declare function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult>;
/**
 * Rate limit configurations for different endpoints
 */
export declare const RATE_LIMITS: {
    AI_ONBOARDING: {
        maxRequests: number;
        windowSeconds: number;
    };
    AI_QUIZ: {
        maxRequests: number;
        windowSeconds: number;
    };
    AI_PLAN: {
        maxRequests: number;
        windowSeconds: number;
    };
    AI_COACH: {
        maxRequests: number;
        windowSeconds: number;
    };
    AUTH_LOGIN: {
        maxRequests: number;
        windowSeconds: number;
        blockDurationSeconds: number;
    };
    AUTH_REGISTER: {
        maxRequests: number;
        windowSeconds: number;
    };
    API_GENERAL: {
        maxRequests: number;
        windowSeconds: number;
    };
    API_WRITE: {
        maxRequests: number;
        windowSeconds: number;
    };
    IP_GENERAL: {
        maxRequests: number;
        windowSeconds: number;
    };
};
/**
 * Check rate limit for user
 */
export declare function checkUserRateLimit(userId: string, endpoint: string, config: RateLimitConfig): Promise<RateLimitResult>;
/**
 * Check rate limit for IP
 */
export declare function checkIPRateLimit(ip: string, endpoint: string, config: RateLimitConfig): Promise<RateLimitResult>;
/**
 * Reset rate limit for a key (admin function)
 */
export declare function resetRateLimit(key: string): Promise<void>;
//# sourceMappingURL=rate-limit.service.d.ts.map