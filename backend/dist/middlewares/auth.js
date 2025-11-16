import { supabaseAdmin } from "../lib/services.js";
/**
 * Middleware to validate Supabase JWT tokens
 * Verifies the token and attaches user info to req.user
 */
export async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Missing authorization header",
                message: "Authorization header with Bearer token is required",
            });
        }
        const token = authHeader.slice(7);
        // Verify JWT token with Supabase
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data.user) {
            return res.status(401).json({
                error: "Invalid or expired token",
                message: error?.message || "Token validation failed",
            });
        }
        // Attach user to request
        req.user = {
            id: data.user.id,
            email: data.user.email ?? undefined,
            role: data.user.role ?? undefined,
            aud: data.user.aud ?? undefined,
        };
        next();
    }
    catch (err) {
        console.error("Auth middleware error:", err);
        return res.status(401).json({
            error: "Authentication failed",
            message: "Unable to verify token",
        });
    }
}
/**
 * Optional auth middleware - doesn't fail if no token
 * Useful for endpoints that work with or without auth
 */
export async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.slice(7);
            const { data } = await supabaseAdmin.auth.getUser(token);
            if (data.user) {
                req.user = {
                    id: data.user.id,
                    email: data.user.email ?? undefined,
                    role: data.user.role ?? undefined,
                    aud: data.user.aud ?? undefined,
                };
            }
        }
        next();
    }
    catch (err) {
        // Continue without user
        next();
    }
}
//# sourceMappingURL=auth.js.map