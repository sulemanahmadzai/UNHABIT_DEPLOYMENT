import { verifyAccessJwt } from "../utils/jwt.js";
export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token)
        return res.status(401).json({ error: "Missing token" });
    try {
        const decoded = verifyAccessJwt(token);
        req.user = decoded;
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid/expired token" });
    }
}
//# sourceMappingURL=auth.js.map