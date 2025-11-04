import { prisma } from "../db/prisma.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAccessJwt, signRefreshJwt } from "../utils/jwt.js";
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
import { v4 as uuid } from "uuid";

export async function register(
  email: string,
  password: string,
  displayName?: string
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already in use");
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
  });
  return user;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    throw new Error("Invalid credentials");
  const accessToken = signAccessJwt({ sub: user.id, email: user.email });
  const refreshToken = signRefreshJwt({ sub: user.id });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: addDays(new Date(), 7),
    },
  });

  return { user, accessToken, refreshToken };
}

export async function rotate(refreshToken: string) {
  const rt = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });
  if (!rt || rt.expiresAt < new Date()) throw new Error("Invalid refresh");

  const user = await prisma.user.findUnique({ where: { id: rt.userId } });
  if (!user) throw new Error("User not found");

  const accessToken = signAccessJwt({ sub: user.id, email: user.email });
  return { accessToken };
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken
    .delete({ where: { token: refreshToken } })
    .catch(() => {});
  return { ok: true };
}
