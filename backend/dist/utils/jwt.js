import { sign, verify } from "jsonwebtoken";
export function signAccessJwt(payload) {
    const secret = process.env.JWT_ACCESS_SECRET;
    const options = { expiresIn: process.env.JWT_ACCESS_TTL || "15m" };
    return sign(payload, secret, options);
}
export function signRefreshJwt(payload) {
    const secret = process.env.JWT_REFRESH_SECRET;
    const options = { expiresIn: process.env.JWT_REFRESH_TTL || "7d" };
    return sign(payload, secret, options);
}
export function verifyAccessJwt(token) {
    return verify(token, process.env.JWT_ACCESS_SECRET);
}
export function verifyRefreshJwt(token) {
    return verify(token, process.env.JWT_REFRESH_SECRET);
}
//# sourceMappingURL=jwt.js.map