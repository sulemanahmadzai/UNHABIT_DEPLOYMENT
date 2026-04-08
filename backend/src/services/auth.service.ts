import { supabaseAdmin, supabase, db } from "../lib/services.js";

/**
 * Auth Service - Handles Supabase authentication and profile syncing
 * 
 * Note: Most auth operations should happen on the frontend using @supabase/supabase-js
 * This service is for backend-initiated operations and profile management
 */

/**
 * Register a new user via backend (admin)
 * Frontend should use supabase.auth.signUp() directly
 */
export async function register(
  email: string,
  password: string,
  metadata?: { full_name?: string | undefined; [key: string]: any }
) {
  // Create user in Supabase Auth
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email for admin creation
    user_metadata: metadata || {},
  });

  if (error) {
    throw new Error(`Registration failed: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("User creation failed");
  }

  // Create profile in Prisma (sync with public.profiles)
  await createOrUpdateProfile(data.user.id, {
    full_name: metadata?.full_name ?? undefined,
    email: data.user.email ?? undefined,
  });

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at,
    },
  };
}

/**
 * Admin login - generates session for a user
 * Frontend should use supabase.auth.signInWithPassword() directly
 */
export async function adminLogin(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const authError: any = new Error(`Login failed: ${error.message}`);
    authError.status = 401; // Set status code for error handler
    authError.statusCode = 401;
    throw authError;
  }

  return {
    user: data.user,
    session: data.session,
    access_token: data.session?.access_token,
    refresh_token: data.session?.refresh_token,
  };
}

type OAuthProvider = "google" | "apple";

/**
 * Handle OAuth login by exchanging a provider id_token with Supabase
 */
export async function loginWithOAuth(
  provider: OAuthProvider,
  params: { idToken: string; nonce?: string | undefined }
) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider,
    token: params.idToken,
    ...(params.nonce && { nonce: params.nonce }),
  });

  if (error) {
    throw new Error(`OAuth login failed (${provider}): ${error.message}`);
  }

  if (!data.user || !data.session) {
    throw new Error("OAuth login failed: missing session");
  }

  await createOrUpdateProfile(data.user.id, {
    full_name:
      (data.user.user_metadata as Record<string, any>)?.full_name ??
      (data.user.user_metadata as Record<string, any>)?.name ??
      undefined,
    avatar_url: (data.user.user_metadata as Record<string, any>)?.avatar_url,
    email: data.user.email ?? undefined,
  });

  return {
    user: data.user,
    session: data.session,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

/**
 * Verify a user's email using OTP
 */
export async function verifyEmail(email: string, token: string) {
  const { data, error } = await supabaseAdmin.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    throw new Error(`Email verification failed: ${error.message}`);
  }

  return { user: data.user, session: data.session };
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(email: string) {
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/auth/reset-password`,
  });

  if (error) {
    throw new Error(`Password reset failed: ${error.message}`);
  }

  return { message: "Password reset email sent" };
}

/**
 * Update user password (admin)
 */
export async function updatePassword(userId: string, newPassword: string) {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  );

  if (error) {
    throw new Error(`Password update failed: ${error.message}`);
  }

  return { user: data.user };
}

/**
 * Delete user account
 */
export async function deleteUser(userId: string) {
  // Delete from Supabase Auth (will cascade to related tables if RLS is set up)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(`User deletion failed: ${error.message}`);
  }

  return { message: "User deleted successfully" };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data.user;
}

/**
 * Create or update user profile in Prisma
 * This syncs the auth.users table with public.profiles
 */
export async function createOrUpdateProfile(
  userId: string,
  profileData: {
    full_name?: string | undefined;
    email?: string | undefined;
    avatar_url?: string | undefined;
    timezone?: string | undefined;
    locale?: string | undefined;
  }
) {
  try {
    // Note: Supabase handles user creation in auth.users automatically
    // We just need to create the profile with the userId from Supabase

    const profile = await db.profiles.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        full_name: profileData.full_name ?? null,
        avatar_url: profileData.avatar_url ?? null,
        timezone: profileData.timezone || "America/New_York",
        locale: profileData.locale || "en",
        onboarded: false,
      },
      update: {
        ...(profileData.full_name !== undefined && { full_name: profileData.full_name }),
        ...(profileData.avatar_url !== undefined && { avatar_url: profileData.avatar_url }),
        ...(profileData.timezone && { timezone: profileData.timezone }),
        ...(profileData.locale && { locale: profileData.locale }),
        updated_at: new Date(),
      },
    });

    return profile;
  } catch (error) {
    console.error("Profile sync error:", error);
    // Log the actual error for debugging
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    throw error;
  }
}

/**
 * Get user profile from Prisma
 */
export async function getProfile(userId: string) {
  const profile = await db.profiles.findUnique({
    where: { user_id: userId },
  });

  return profile;
}

/**
 * One-time PaymentSheet purchases are stored in payment_history with status succeeded
 * and stripe_invoice_id null (subscription invoice payments set invoice id).
 */
export async function getOneTimePurchaseEntitlement(userId: string) {
  const row = await db.payment_history.findFirst({
    where: {
      user_id: userId,
      status: "succeeded",
      stripe_invoice_id: null,
    },
    orderBy: { created_at: "desc" },
  });

  const unlocked = !!row;
  return {
    has_paid: unlocked,
    has_premium: unlocked,
    one_time_purchase_at: row?.created_at?.toISOString() ?? null,
  };
}

/**
 * Mark user as onboarded
 */
export async function markOnboarded(userId: string) {
  const profile = await db.profiles.update({
    where: { user_id: userId },
    data: { onboarded: true, updated_at: new Date() },
  });

  return profile;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshSession(refreshToken: string) {
  const { data, error } = await supabaseAdmin.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) {
    throw new Error(`Token refresh failed: ${error.message}`);
  }

  if (!data.session) {
    throw new Error("Failed to refresh session");
  }

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    user: {
      id: data.user?.id,
      email: data.user?.email,
    },
  };
}
