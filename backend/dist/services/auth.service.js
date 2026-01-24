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
export async function register(email, password, metadata) {
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
export async function adminLogin(email, password) {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
    });
    if (error) {
        throw new Error(`Login failed: ${error.message}`);
    }
    return {
        user: data.user,
        session: data.session,
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
    };
}
/**
 * Handle OAuth login by exchanging a provider id_token with Supabase
 */
export async function loginWithOAuth(provider, params) {
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
        full_name: data.user.user_metadata?.full_name ??
            data.user.user_metadata?.name ??
            undefined,
        avatar_url: data.user.user_metadata?.avatar_url,
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
export async function verifyEmail(email, token) {
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
export async function sendPasswordReset(email) {
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
export async function updatePassword(userId, newPassword) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) {
        throw new Error(`Password update failed: ${error.message}`);
    }
    return { user: data.user };
}
/**
 * Delete user account
 */
export async function deleteUser(userId) {
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
export async function getUserById(userId) {
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
export async function createOrUpdateProfile(userId, profileData) {
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
    }
    catch (error) {
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
export async function getProfile(userId) {
    const profile = await db.profiles.findUnique({
        where: { user_id: userId },
    });
    return profile;
}
/**
 * Mark user as onboarded
 */
export async function markOnboarded(userId) {
    const profile = await db.profiles.update({
        where: { user_id: userId },
        data: { onboarded: true, updated_at: new Date() },
    });
    return profile;
}
//# sourceMappingURL=auth.service.js.map