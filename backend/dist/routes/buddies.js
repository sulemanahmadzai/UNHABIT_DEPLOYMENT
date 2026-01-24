import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import * as BuddiesService from "../services/buddies.service.js";
const r = Router();
/**
 * GET /api/buddies
 * List buddies
 */
r.get("/", requireAuth, async (req, res, next) => {
    try {
        const buddies = await BuddiesService.getBuddies(req.user.id);
        res.json({ success: true, data: buddies });
    }
    catch (error) {
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
        const invite = await BuddiesService.createInvite(req.user.id, {
            target_contact: data.target_contact,
            expires_in_days: data.expires_in_days,
        });
        res.status(201).json({ success: true, data: invite });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/buddies/invites
 * List sent invites
 */
r.get("/invites", requireAuth, async (req, res, next) => {
    try {
        const invites = await BuddiesService.getSentInvites(req.user.id);
        res.json({ success: true, data: invites });
    }
    catch (error) {
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
        const result = await BuddiesService.acceptInvite(req.user.id, inviteCode);
        if (!result) {
            return res.status(404).json({
                success: false,
                error: "Invite not found or expired",
            });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
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
        const checkin = await BuddiesService.submitCheckin(req.user.id, {
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
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/buddies/checkins
 * Get buddy check-ins
 */
r.get("/checkins", requireAuth, async (req, res, next) => {
    try {
        const buddyLinkId = req.query.buddy_link_id || undefined;
        const limit = parseInt(req.query.limit) || 30;
        const checkins = await BuddiesService.getCheckins(req.user.id, buddyLinkId, limit);
        res.json({ success: true, data: checkins });
    }
    catch (error) {
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
        const message = await BuddiesService.sendMessage(req.user.id, {
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
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/buddies/messages
 * Get messages
 */
r.get("/messages", requireAuth, async (req, res, next) => {
    try {
        const buddyLinkId = req.query.buddy_link_id;
        if (!buddyLinkId) {
            return res.status(400).json({
                success: false,
                error: "buddy_link_id is required",
            });
        }
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const messages = await BuddiesService.getMessages(req.user.id, buddyLinkId, limit, offset);
        res.json({ success: true, data: messages });
    }
    catch (error) {
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
        const reaction = await BuddiesService.addReaction(req.user.id, {
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
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/buddies/summary
 * Get weekly summary
 */
r.get("/summary", requireAuth, async (req, res, next) => {
    try {
        const summary = await BuddiesService.getWeeklySummary(req.user.id);
        res.json({ success: true, data: summary });
    }
    catch (error) {
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
        const deleted = await BuddiesService.removeBuddyLink(req.user.id, linkId);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: "Buddy link not found",
            });
        }
        res.json({ success: true, message: "Buddy removed successfully" });
    }
    catch (error) {
        next(error);
    }
});
export default r;
//# sourceMappingURL=buddies.js.map