// src/lib/services.ts
import { prisma } from "./prisma";
import { createClient } from "@supabase/supabase-js";

export const db = prisma;

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);




