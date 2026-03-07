import { Router } from "express";
import { z } from "zod";
import * as Auth from "../services/auth.service.js";
import { requireAuth } from "../middlewares/auth.js";

const r = Router();
const oauthProviderSchema = z.enum(["google", "apple"]);

/**
 * POST /api/auth/register
 * Register a new user (backend admin creation)
 * Frontend should typically use Supabase client directly
 */
r.post("/register", async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      full_name: z.string().optional(),
    });
    const data = schema.parse(req.body);
    
    const result = await Auth.register(data.email, data.password, 
      data.full_name ? { full_name: data.full_name } : undefined
    );
    
    res.status(201).json({
      success: true,
      user: result.user,
      message: "User registered successfully. Please check email for verification.",
    });
  } catch (error: any) {
    // If it's a ZodError, it will be handled by error handler
    // But we can also handle it here for clarity
    if (error.name === 'ZodError' || error.issues) {
      return res.status(400).json({
        success: false,
        error: `Validation error: ${error.issues?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') || error.message}`,
      });
    }
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Login with email/password (backend proxy)
 * Frontend should use supabase.auth.signInWithPassword() directly
 */
r.post("/login", async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });
    const { email, password } = schema.parse(req.body);
    
    const result = await Auth.adminLogin(email, password);
    
    res.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        created_at: result.user.created_at,
      },
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.session?.expires_in,
    });
  } catch (error: any) {
    // Handle Zod validation errors
    if (error.name === 'ZodError' || error.issues) {
      return res.status(400).json({
        success: false,
        error: `Validation error: ${error.issues?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') || error.message}`,
      });
    }
    // Auth errors should have status set by service
    next(error);
  }
});

/**
 * POST /api/auth/oauth/:provider
 * Complete OAuth login by exchanging provider id_token for Supabase session
 */
r.post("/oauth/:provider", async (req, res, next) => {
  try {
    const provider = oauthProviderSchema.parse(req.params.provider);
    const schema = z.object({
      id_token: z.string(),
      nonce: z.string().optional(),
    });
    const { id_token, nonce } = schema.parse(req.body);

    const result = await Auth.loginWithOAuth(provider, {
      idToken: id_token,
      nonce: nonce,
    });

    res.json({
      success: true,
      provider,
      user: {
        id: result.user.id,
        email: result.user.email,
        created_at: result.user.created_at,
      },
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.session?.expires_in,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email with OTP token
 */
r.post("/verify-email", async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      token: z.string(),
    });
    const { email, token } = schema.parse(req.body);
    
    const result = await Auth.verifyEmail(email, token);
    
    res.json({
      success: true,
      user: result.user,
      session: result.session,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
r.post("/forgot-password", async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
    });
    const { email } = schema.parse(req.body);
    
    await Auth.sendPasswordReset(email);
    
    res.json({
      success: true,
      message: "Password reset email sent if account exists",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with new password (requires auth)
 */
r.post("/reset-password", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      new_password: z.string().min(8),
    });
    const { new_password } = schema.parse(req.body);
    
    await Auth.updatePassword(req.user!.id, new_password);
    
    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
r.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    
    // Get user from Supabase
    const user = await Auth.getUserById(userId);
    
    // Get profile from Prisma
    const profile = await Auth.getProfile(userId);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
      },
      profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
r.put("/profile", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      full_name: z.string().optional(),
      avatar_url: z.string().url().optional(),
      timezone: z.string().optional(),
      locale: z.string().optional(),
    });
    const data = schema.parse(req.body);
    
    const profileData = {
      full_name: data.full_name ?? undefined,
      avatar_url: data.avatar_url ?? undefined,
      timezone: data.timezone ?? undefined,
      locale: data.locale ?? undefined,
    };
    
    const profile = await Auth.createOrUpdateProfile(req.user!.id, profileData);
    
    res.json({
      success: true,
      profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/onboarded
 * Mark user as onboarded
 */
r.post("/onboarded", requireAuth, async (req, res, next) => {
  try {
    const profile = await Auth.markOnboarded(req.user!.id);
    
    res.json({
      success: true,
      profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/auth/account
 * Delete user account
 */
r.delete("/account", requireAuth, async (req, res, next) => {
  try {
    await Auth.deleteUser(req.user!.id);
    
    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
r.post("/refresh", async (req, res, next) => {
  try {
    const schema = z.object({
      refresh_token: z.string(),
    });
    const { refresh_token } = schema.parse(req.body);

    const result = await Auth.refreshSession(refresh_token);

    res.json({
      success: true,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Logout user (invalidate session)
 */
r.post("/logout", requireAuth, async (req, res, next) => {
  try {
    // For Supabase, logout is typically handled client-side
    // This endpoint can be used to clear server-side session if needed
    // For now, just return success
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default r;
