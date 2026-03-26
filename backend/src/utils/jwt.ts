import jwt, { type Secret, type SignOptions, type JwtPayload } from "jsonwebtoken";

export function signAccessJwt(payload: object) {
  const secret: Secret = process.env.JWT_ACCESS_SECRET as Secret;
  const options: SignOptions = { expiresIn: (process.env.JWT_ACCESS_TTL as any) || "15m" };
  return jwt.sign(payload as any, secret, options);
}
export function signRefreshJwt(payload: object) {
  const secret: Secret = process.env.JWT_REFRESH_SECRET as Secret;
  const options: SignOptions = { expiresIn: (process.env.JWT_REFRESH_TTL as any) || "7d" };
  return jwt.sign(payload as any, secret, options);
}
export function verifyAccessJwt<T = JwtPayload>(token: string) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET as Secret) as T;
}
export function verifyRefreshJwt<T = JwtPayload>(token: string) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET as Secret) as T;
}
