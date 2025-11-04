import bcrypt from "bcryptjs";
export const hashPassword = (p) => bcrypt.hash(p, 12);
export const verifyPassword = (p, hash) => bcrypt.compare(p, hash);
//# sourceMappingURL=password.js.map