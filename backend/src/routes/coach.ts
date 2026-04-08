import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as CoachService from "../services/coach.service.js";
import * as AIClient from "../services/ai-client.service.js";
import { isValidUUID } from "../utils/validation.js";
import { db } from "../lib/services.js";
import * as Scenarios from "../services/notification-scenarios.service.js";

const r = Router();

// ---------------------------------------------------------------------------
// Helper: motivation messages keyed on journey phase
// ---------------------------------------------------------------------------
function getMotivationMessage(dayNumber: number, totalDays: number): string {
  const progress = dayNumber / totalDays;

  if (dayNumber === 1) {
    return "Every great journey begins with a single step. Today is your Day 1!";
  }
  if (dayNumber === totalDays) {
    return `🏆 Final day! You've made it this far — finish strong!`;
  }
  if (progress < 0.33) {
    const messages = [
      `Day ${dayNumber} of ${totalDays} — you're building momentum. Keep going!`,
      "The early days are the hardest. You're doing great!",
      "Consistency now will become identity later. Stay the course.",
    ];
    return messages[dayNumber % messages.length]!;
  }
  if (progress < 0.66) {
    const messages = [
      `Halfway there! Day ${dayNumber} of ${totalDays} — your habit is forming.`,
      "You're in the habit-building zone now. Push through!",
      "More than halfway done — your future self will thank you.",
    ];
    return messages[dayNumber % messages.length]!;
  }
  const messages = [
    `Almost there! Day ${dayNumber} of ${totalDays} — the finish line is close!`,
    "Final stretch! You've worked too hard to stop now.",
    `Only ${totalDays - dayNumber} days left — you've got this!`,
  ];
  return messages[dayNumber % messages.length]!;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

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
    const session = await CoachService.getSessionWithMessages(req.user!.id, sessionId);

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
    const session = await CoachService.getSessionWithMessages(req.user!.id, sessionId);

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
    const assistantMessage = await CoachService.addMessage(
      sessionId,
      "assistant",
      aiResult.data.coach_reply,
      { chat_history: aiResult.data.chat_history }
    );

    // Fire-and-forget: privacy-safe coach reply notification via scenario system
    Scenarios.notifyCoachReply(req.user!.id, sessionId).catch(() => {});

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

/**
 * GET /api/coach/motivation
 * Returns daily motivation object for the AI Coach top card.
 * Response: { dayNumber: number, totalDays: number, message: string }
 */
r.get("/motivation", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    // Resolve user's active journey to get day context
    const journey = await db.journeys.findFirst({
      where: { user_id: userId, status: "active" },
      orderBy: { created_at: "desc" },
    });

    let dayNumber = 1;
    let totalDays = 21;

    if (journey && journey.start_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(journey.start_date);
      startDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor(
        (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      dayNumber = Math.min(Math.max(diffDays + 1, 1), journey.planned_days);
      totalDays = journey.planned_days;
    }

    const message = getMotivationMessage(dayNumber, totalDays);

    res.json({
      success: true,
      data: { dayNumber, totalDays, message },
    });
  } catch (error) {
    next(error);
  }
});

export default r;
