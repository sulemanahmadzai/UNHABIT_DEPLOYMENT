import type { Request, Response, NextFunction } from "express";
import { verifyAccessJwt } from "../utils/jwt.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const decoded = verifyAccessJwt(token);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid/expired token" });
  }
}



