import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as BuddiesService from "../services/buddies.service.js";
import { isValidUUID } from "../utils/validation.js";
import * as Scenarios from "../services/notification-scenarios.service.js";
import { db } from "../lib/services.js";

const r = Router();

/**
 * GET /api/buddies
 * List buddies
 */
r.get("/", requireAuth, async (req, res, next) => {
  try {
    const buddies = await BuddiesService.getBuddies(req.user!.id);
    res.json({ success: true, data: buddies });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/buddies/invite
 * Create invite link
 */
r.post("/invite", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      target_contact: z.string().optional(),
      expires_in_days: z.number().int().min(1).max(30).optional().default(7),
    });
    const data = schema.parse(req.body);

    const invite = await BuddiesService.createInvite(req.user!.id, {
      target_contact: data.target_contact,
      expires_in_days: data.expires_in_days,
    });

    res.status(201).json({ success: true, data: invite });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/buddies/invites
 * List sent invites
 */
r.get("/invites", requireAuth, async (req, res, next) => {
  try {
    const invites = await BuddiesService.getSentInvites(req.user!.id);
    res.json({ success: true, data: invites });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/buddies/accept/:inviteCode
 * Accept invite
 */
r.post("/accept/:inviteCode", requireAuth, async (req, res, next) => {
  try {
    const inviteCode = req.params.inviteCode;
    if (!inviteCode) {
      return res.status(400).json({ success: false, error: "Invite code is required" });
    }
    const result = await BuddiesService.acceptInvite(req.user!.id, inviteCode);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Invite not found or expired",
      });
    }

    // Notify the inviter that their invite was accepted
    (async () => {
      try {
        const inviterId = result.user_a === req.user!.id ? result.user_b : result.user_a;
        const acceptorProfile = await db.profiles.findUnique({
          where: { user_id: req.user!.id },
          select: { full_name: true },
        });
        await Scenarios.notifyBuddyInviteAccepted(
          inviterId,
          acceptorProfile?.full_name ?? undefined
        );
      } catch {}
    })();

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/buddies/checkin
 * Submit daily check-in
 */
r.post("/checkin", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      buddy_link_id: z.string().uuid(),
      note: z.string().max(500).optional(),
    });
    const data = schema.parse(req.body);

    const checkin = await BuddiesService.submitCheckin(req.user!.id, {
      buddy_link_id: data.buddy_link_id,
      note: data.note,
    });

    if (!checkin) {
      return res.status(404).json({
        success: false,
        error: "Buddy link not found",
      });
    }

    res.status(201).json({ success: true, data: checkin });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/buddies/checkins
 * Get buddy check-ins
 */
r.get("/checkins", requireAuth, async (req, res, next) => {
  try {
    const buddyLinkId = (req.query.buddy_link_id as string) || undefined;
    const limit = parseInt(req.query.limit as string) || 30;

    const checkins = await BuddiesService.getCheckins(req.user!.id, buddyLinkId, limit);
    res.json({ success: true, data: checkins });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/buddies/messages
 * Send message to buddy
 */
r.post("/messages", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      buddy_link_id: z.string().uuid(),
      content: z.string().min(1).max(1000),
    });
    const data = schema.parse(req.body);

    const message = await BuddiesService.sendMessage(req.user!.id, {
      buddy_link_id: data.buddy_link_id,
      content: data.content,
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Buddy link not found",
      });
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/buddies/messages
 * Get messages
 */
r.get("/messages", requireAuth, async (req, res, next) => {
  try {
    const buddyLinkId = req.query.buddy_link_id as string;
    if (!buddyLinkId) {
      return res.status(400).json({
        success: false,
        error: "buddy_link_id is required",
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await BuddiesService.getMessages(
      req.user!.id,
      buddyLinkId,
      limit,
      offset
    );

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/buddies/reactions
 * Add reaction to check-in
 */
r.post("/reactions", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      buddy_checkin_id: z.string().uuid(),
      emoji: z.string().min(1).max(10),
    });
    const data = schema.parse(req.body);

    const reaction = await BuddiesService.addReaction(req.user!.id, {
      buddy_checkin_id: data.buddy_checkin_id,
      emoji: data.emoji,
    });

    if (!reaction) {
      return res.status(404).json({
        success: false,
        error: "Check-in not found",
      });
    }

    res.status(201).json({ success: true, data: reaction });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/buddies/summary
 * Get weekly summary
 */
r.get("/summary", requireAuth, async (req, res, next) => {
  try {
    const summary = await BuddiesService.getWeeklySummary(req.user!.id);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/buddies/:id
 * Remove buddy link
 */
r.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const linkId = req.params.id;
    if (!linkId) {
      return res.status(400).json({ success: false, error: "Buddy link ID is required" });
    }
    const deleted = await BuddiesService.removeBuddyLink(req.user!.id, linkId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Buddy link not found",
      });
    }

    res.json({ success: true, message: "Buddy removed successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/buddies/quick-view
 * Get buddy quick view for home screen
 */
r.get("/quick-view", requireAuth, async (req, res, next) => {
  try {
    const quickView = await BuddiesService.getQuickView(req.user!.id);
    res.json({ success: true, data: quickView });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/buddies/:id/profile
 * Get buddy profile with their progress
 */
r.get("/:id/profile", requireAuth, async (req, res, next) => {
  try {
    const buddyLinkId = req.params.id;
    if (!buddyLinkId) {
      return res.status(400).json({ success: false, error: "Buddy link ID is required" });
    }
    if (!isValidUUID(buddyLinkId)) {
      return res.status(400).json({ success: false, error: "Invalid buddy link ID format" });
    }
    const profile = await BuddiesService.getBuddyProfile(req.user!.id, buddyLinkId);
    if (!profile) {
      return res.status(404).json({ success: false, error: "Buddy not found" });
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/buddies/:id/nudge
 * Send a quick nudge to buddy
 */
r.post("/:id/nudge", requireAuth, async (req, res, next) => {
  try {
    const buddyLinkId = req.params.id;
    if (!buddyLinkId) {
      return res.status(400).json({ success: false, error: "Buddy link ID is required" });
    }
    const schema = z.object({
      message: z.string().min(1).max(200),
    });
    const { message } = schema.parse(req.body);

    const nudge = await BuddiesService.sendNudge(req.user!.id, buddyLinkId, message);
    if (!nudge) {
      return res.status(404).json({ success: false, error: "Buddy link not found" });
    }
    res.status(201).json({ success: true, data: nudge });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/buddies/nudges
 * Get received nudges
 */
r.get("/nudges", requireAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const nudges = await BuddiesService.getNudges(req.user!.id, limit);
    res.json({ success: true, data: nudges });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/buddies/invites/:id/resend
 * Resend an invite
 */
r.post("/invites/:id/resend", requireAuth, async (req, res, next) => {
  try {
    const inviteId = req.params.id;
    if (!inviteId) {
      return res.status(400).json({ success: false, error: "Invite ID is required" });
    }
    const invite = await BuddiesService.resendInvite(req.user!.id, inviteId);
    if (!invite) {
      return res.status(404).json({ success: false, error: "Invite not found or already accepted" });
    }
    res.json({ success: true, data: invite });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/buddies/invites/:id
 * Cancel an invite
 */
r.delete("/invites/:id", requireAuth, async (req, res, next) => {
  try {
    const inviteId = req.params.id;
    if (!inviteId) {
      return res.status(400).json({ success: false, error: "Invite ID is required" });
    }
    const cancelled = await BuddiesService.cancelInvite(req.user!.id, inviteId);
    if (!cancelled) {
      return res.status(404).json({ success: false, error: "Invite not found" });
    }
    res.json({ success: true, message: "Invite cancelled" });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/buddies/invite/:code/url
 * Get invite URL for a code
 */
r.get("/invite/:code/url", requireAuth, async (req, res, next) => {
  try {
    const code = req.params.code;
    if (!code) {
      return res.status(400).json({ success: false, error: "Invite code is required" });
    }
    // Verify invite exists
    const invite = await BuddiesService.getInviteByCode(code);
    if (!invite) {
      return res.status(404).json({ success: false, error: "Invite not found" });
    }
    const url = BuddiesService.getInviteUrl(code);
    res.json({ success: true, data: { invite_url: url } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/buddies/completed-today
 * Get buddies who completed tasks today
 */
r.get("/completed-today", requireAuth, async (req, res, next) => {
  try {
    const buddies = await BuddiesService.getBuddiesCompletedToday(req.user!.id);
    res.json({ success: true, data: buddies });
  } catch (error) {
    next(error);
  }
});

export default r;
