import { type JwtPayload } from "jsonwebtoken";
export declare function signAccessJwt(payload: object): string;
export declare function signRefreshJwt(payload: object): string;
export declare function verifyAccessJwt<T = JwtPayload>(token: string): T;
export declare function verifyRefreshJwt<T = JwtPayload>(token: string): T;
//# sourceMappingURL=jwt.d.ts.map