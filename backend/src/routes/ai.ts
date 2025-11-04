import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import { getSuggestion } from "../services/ai.service.js";

const r = Router();

r.post("/suggest", requireAuth, async (req, res) => {
  const schema = z.object({ prompt: z.string().min(1) });
  const { prompt } = schema.parse(req.body);
  const text = await getSuggestion(prompt);
  res.json({ text });
});

export default r;
