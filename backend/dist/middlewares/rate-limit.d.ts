import type { Request, Response, NextFunction } from "express";
import { type RateLimitConfig } from "../services/rate-limit.service.js";
/**
 * Rate limiting middleware factory
 *
 * Usage:
 *   router.post('/expensive', rateLimit(RATE_LIMITS.AI_PLAN), handler);
 */
export declare function rateLimit(config: RateLimitConfig): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Predefined rate limiters for common use cases
 */
export declare const rateLimiters: {
    aiOnboarding: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    aiQuiz: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    aiPlan: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    aiCoach: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    authLogin: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    authRegister: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    apiGeneral: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    apiWrite: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
};
//# sourceMappingURL=rate-limit.d.ts.map