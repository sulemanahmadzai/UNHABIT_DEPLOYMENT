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
export declare function register(email: string, password: string, metadata?: {
    full_name?: string | undefined;
    [key: string]: any;
}): Promise<{
    user: {
        id: string;
        email: string | undefined;
        created_at: string;
    };
}>;
/**
 * Admin login - generates session for a user
 * Frontend should use supabase.auth.signInWithPassword() directly
 */
export declare function adminLogin(email: string, password: string): Promise<{
    user: import("@supabase/auth-js").User;
    session: import("@supabase/auth-js").Session;
    access_token: string;
    refresh_token: string;
}>;
type OAuthProvider = "google" | "apple";
/**
 * Handle OAuth login by exchanging a provider id_token with Supabase
 */
export declare function loginWithOAuth(provider: OAuthProvider, params: {
    idToken: string;
    nonce?: string | undefined;
}): Promise<{
    user: import("@supabase/auth-js").User;
    session: import("@supabase/auth-js").Session;
    access_token: string;
    refresh_token: string;
}>;
/**
 * Verify a user's email using OTP
 */
export declare function verifyEmail(email: string, token: string): Promise<{
    user: import("@supabase/auth-js").User | null;
    session: import("@supabase/auth-js").Session | null;
}>;
/**
 * Send password reset email
 */
export declare function sendPasswordReset(email: string): Promise<{
    message: string;
}>;
/**
 * Update user password (admin)
 */
export declare function updatePassword(userId: string, newPassword: string): Promise<{
    user: import("@supabase/auth-js").User;
}>;
/**
 * Delete user account
 */
export declare function deleteUser(userId: string): Promise<{
    message: string;
}>;
/**
 * Get user by ID
 */
export declare function getUserById(userId: string): Promise<import("@supabase/auth-js").User>;
/**
 * Create or update user profile in Prisma
 * This syncs the auth.users table with public.profiles
 */
export declare function createOrUpdateProfile(userId: string, profileData: {
    full_name?: string | undefined;
    email?: string | undefined;
    avatar_url?: string | undefined;
    timezone?: string | undefined;
    locale?: string | undefined;
}): Promise<{
    full_name: string | null;
    user_id: string;
    avatar_url: string | null;
    timezone: string;
    locale: string;
    onboarded: boolean;
    role: import("@prisma/client").$Enums.user_role;
    created_at: Date;
    updated_at: Date;
}>;
/**
 * Get user profile from Prisma
 */
export declare function getProfile(userId: string): Promise<{
    full_name: string | null;
    user_id: string;
    avatar_url: string | null;
    timezone: string;
    locale: string;
    onboarded: boolean;
    role: import("@prisma/client").$Enums.user_role;
    created_at: Date;
    updated_at: Date;
} | null>;
/**
 * Mark user as onboarded
 */
export declare function markOnboarded(userId: string): Promise<{
    full_name: string | null;
    user_id: string;
    avatar_url: string | null;
    timezone: string;
    locale: string;
    onboarded: boolean;
    role: import("@prisma/client").$Enums.user_role;
    created_at: Date;
    updated_at: Date;
}>;
/**
 * Refresh access token using refresh token
 */
export declare function refreshSession(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: {
        id: string | undefined;
        email: string | undefined;
    };
}>;
export {};
//# sourceMappingURL=auth.service.d.ts.map