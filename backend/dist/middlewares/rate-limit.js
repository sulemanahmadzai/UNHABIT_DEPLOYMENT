import { checkUserRateLimit, checkIPRateLimit, RATE_LIMITS, } from "../services/rate-limit.service.js";
/**
 * Rate limiting middleware factory
 *
 * Usage:
 *   router.post('/expensive', rateLimit(RATE_LIMITS.AI_PLAN), handler);
 */
export function rateLimit(config) {
    return async (req, res, next) => {
        try {
            // Get user ID or IP
            const userId = req.user?.id;
            const ip = req.ip || req.socket.remoteAddress || "unknown";
            const endpoint = req.path;
            // Check rate limit (prefer user-based, fallback to IP)
            const result = userId
                ? await checkUserRateLimit(userId, endpoint, config)
                : await checkIPRateLimit(ip, endpoint, config);
            // Add rate limit headers
            res.setHeader("X-RateLimit-Limit", config.maxRequests);
            res.setHeader("X-RateLimit-Remaining", result.remaining);
            res.setHeader("X-RateLimit-Reset", result.resetAt.toISOString());
            if (!result.allowed) {
                if (result.retryAfter) {
                    res.setHeader("Retry-After", result.retryAfter);
                }
                return res.status(429).json({
                    success: false,
                    error: "Rate limit exceeded",
                    message: `Too many requests. Please try again in ${result.retryAfter || config.windowSeconds} seconds.`,
                    retry_after: result.retryAfter,
                    reset_at: result.resetAt.toISOString(),
                });
            }
            next();
        }
        catch (error) {
            console.error("Rate limit middleware error:", error);
            // On error, allow request (fail open)
            next();
        }
    };
}
/**
 * Predefined rate limiters for common use cases
 */
export const rateLimiters = {
    aiOnboarding: rateLimit(RATE_LIMITS.AI_ONBOARDING),
    aiQuiz: rateLimit(RATE_LIMITS.AI_QUIZ),
    aiPlan: rateLimit(RATE_LIMITS.AI_PLAN),
    aiCoach: rateLimit(RATE_LIMITS.AI_COACH),
    authLogin: rateLimit(RATE_LIMITS.AUTH_LOGIN),
    authRegister: rateLimit(RATE_LIMITS.AUTH_REGISTER),
    apiGeneral: rateLimit(RATE_LIMITS.API_GENERAL),
    apiWrite: rateLimit(RATE_LIMITS.API_WRITE),
};
//# sourceMappingURL=rate-limit.js.map