import { Router } from "express";
import { z } from "zod";
import * as Auth from "../services/auth.service.js";
const r = Router();
r.post("/register", async (req, res) => {
    const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        displayName: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const user = await Auth.register(data.email, data.password, data.displayName);
    res.status(201).json({ userId: user.id });
});
r.post("/login", async (req, res) => {
    const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
    });
    const { email, password } = schema.parse(req.body);
    const { user, accessToken, refreshToken } = await Auth.login(email, password);
    res.json({
        user: { id: user.id, email: user.email },
        accessToken,
        refreshToken,
    });
});
r.post("/refresh", async (req, res) => {
    const schema = z.object({ refreshToken: z.string() });
    const { refreshToken } = schema.parse(req.body);
    const { accessToken } = await Auth.rotate(refreshToken);
    res.json({ accessToken });
});
r.post("/logout", async (req, res) => {
    const schema = z.object({ refreshToken: z.string() });
    const { refreshToken } = schema.parse(req.body);
    const out = await Auth.logout(refreshToken);
    res.json(out);
});
export default r;
//# sourceMappingURL=auth.js.map