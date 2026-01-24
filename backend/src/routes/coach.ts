import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as CoachService from "../services/coach.service.js";
import * as AIClient from "../services/ai-client.service.js";
import { isValidUUID } from "../utils/validation.js";

const r = Router();

/**
 * GET /api/coach/sessions
 * List coach sessions
 */
r.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const sessions = await CoachService.getSessions(req.user!.id, limit);
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/coach/sessions
 * Start new session
 */
r.post("/sessions", requireAuth, async (req, res, next) => {
  try {
    const session = await CoachService.createSession(req.user!.id);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/coach/sessions/:id
 * Get session with messages
 */
r.get("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "Session ID is required" });
    }
    if (!isValidUUID(sessionId)) {
      return res.status(400).json({ success: false, error: "Invalid session ID format" });
    }
    const session = await CoachService.getSessionWithMessages(
      req.user!.id,
      sessionId
    );

    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/coach/sessions/:id/messages
 * Send message (proxies to AI service)
 */
r.post("/sessions/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "Session ID is required" });
    }
    if (!isValidUUID(sessionId)) {
      return res.status(400).json({ success: false, error: "Invalid session ID format" });
    }
    
    const schema = z.object({
      message: z.string().min(1).max(2000),
      context: z
        .object({
          journey_day: z.number().int().optional(),
          current_streak: z.number().int().optional(),
          recent_slip: z.boolean().optional(),
        })
        .optional(),
    });
    const data = schema.parse(req.body);

    // Get session and messages
    const session = await CoachService.getSessionWithMessages(
      req.user!.id,
      sessionId
    );

    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }

    if (session.ended_at) {
      return res.status(400).json({ success: false, error: "Session has ended" });
    }

    // Save user message
    await CoachService.addMessage(sessionId, "user", data.message);

    // Build session history for AI
    const sessionHistory = session.coach_messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Call AI service
    const aiResult = await AIClient.chat({
      message: data.message,
      session_history: sessionHistory,
      context: data.context,
    });

    if (!aiResult.success || !aiResult.data) {
      // Save error as system message
      await CoachService.addMessage(
        sessionId,
        "system",
        "I'm having trouble connecting right now. Please try again.",
        { error: aiResult.error }
      );

      return res.status(502).json({
        success: false,
        error: "AI service unavailable",
        message: aiResult.error,
      });
    }

    // Save assistant response
    // AI service returns { coach_reply, chat_history }
    const assistantMessage = await CoachService.addMessage(
      sessionId,
      "assistant",
      aiResult.data.coach_reply,
      { chat_history: aiResult.data.chat_history }
    );

    // Note: AI service doesn't return actions, only coach_reply and chat_history
    res.json({
      success: true,
      data: {
        message: assistantMessage,
        chat_history: aiResult.data.chat_history,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/coach/sessions/:id/end
 * End session
 */
r.post("/sessions/:id/end", requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "Session ID is required" });
    }
    if (!isValidUUID(sessionId)) {
      return res.status(400).json({ success: false, error: "Invalid session ID format" });
    }
    const session = await CoachService.endSession(req.user!.id, sessionId);

    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

export default r;
