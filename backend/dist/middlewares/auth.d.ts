import type { Request, Response, NextFunction } from "express";
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email?: string | undefined;
                role?: string | undefined;
                aud?: string | undefined;
                appRole?: "user" | "admin" | undefined;
            };
        }
    }
}
/**
 * Middleware to validate Supabase JWT tokens
 * Verifies the token and attaches user info to req.user
 */
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Optional auth middleware - doesn't fail if no token
 * Useful for endpoints that work with or without auth
 */
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Middleware to require admin role
 * Must be used after requireAuth
 */
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Combined middleware for routes that require both auth and admin
 */
export declare const requireAuthAndAdmin: (typeof requireAuth)[];
//# sourceMappingURL=auth.d.ts.map