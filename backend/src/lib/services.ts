// src/lib/services.ts
import { prisma as prismaClient } from "../db/prisma.js";
import { createClient } from "@supabase/supabase-js";

export const db = prismaClient;
export const prisma = prismaClient; // Alias for new services

// Anon client - for frontend (public operations)
export const supabaseAnon = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

// Admin client - for backend (bypasses RLS, full access)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

// Default export for convenience
export const supabase = supabaseAnon;
