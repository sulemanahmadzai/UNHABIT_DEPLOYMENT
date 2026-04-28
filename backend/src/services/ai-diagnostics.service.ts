import { db } from "../lib/services.js";
import { Prisma } from "@prisma/client";

/**
 * AI Diagnostics Service
 * Stores quiz summaries, quiz forms, safety assessments, and other AI-generated data
 */

// Types for stored AI data
interface QuizFormData {
  habit_name_guess: string;
  questions: Array<{
    id: string;
    question: string;
    helper_text?: string | undefined;
    options: Array<{
      id: string;
      label: string;
    }>;
  }>;
}

interface QuizSummaryData {
  user_habit_raw: string;
  canonical_habit_name: string;
  habit_category: string | null;
  category_confidence: "low" | "medium" | "high";
  product_type: string | null;
  severity_level: "mild" | "moderate" | "severe";
  core_loop?: string | undefined;
  primary_payoff?: string | undefined;
  avoidance_target?: string | undefined;
  identity_link?: string | undefined;
  dopamine_profile?: string | undefined;
  collapse_condition?: string | undefined;
  long_term_cost?: string | undefined;
}

interface SafetyData {
  risk: "none" | "self_harm" | "eating_disorder" | "severe_addiction" | "violence" | "other";
  action: "allow" | "block_and_escalate";
  message: string;
}

interface Plan21DData {
  plan_summary: string;
  day_tasks: Record<string, string>;
  day_whys?: Record<string, string> | undefined;
}

// Create input types
interface CreateDiagnosticInput {
  user_habit_id?: string;
  raw_input: string;
  model?: string;
  parsed_summary?: string;
  scores?: Record<string, unknown>;
}

/**
 * Create a new AI diagnostic entry
 */
export async function createDiagnostic(userId: string, data: CreateDiagnosticInput) {
  return db.ai_diagnostics.create({
    data: {
      user_id: userId,
      user_habit_id: data.user_habit_id || null,
      raw_input: data.raw_input,
      model: data.model || "gpt-4o",
      parsed_summary: data.parsed_summary || null,
      scores: data.scores ? (data.scores as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

/**
 * Store quiz form data
 */
export async function storeQuizForm(
  userId: string,
  userHabitId: string | undefined,
  rawInput: string,
  quizForm: QuizFormData
) {
  return db.ai_diagnostics.create({
    data: {
      user_id: userId,
      user_habit_id: userHabitId || null,
      raw_input: rawInput,
      model: "gpt-4o",
      parsed_summary: JSON.stringify({
        type: "quiz_form",
        data: quizForm,
      }),
      scores: Prisma.JsonNull,
    },
  });
}

/**
 * Store quiz summary data
 */
export async function storeQuizSummary(
  userId: string,
  userHabitId: string | undefined,
  rawInput: string,
  quizSummary: QuizSummaryData,
  userAnswers?: Record<string, unknown>
) {
  // Extract severity and confidence as scores
  const scores: Record<string, unknown> = {
    severity_level: quizSummary.severity_level,
    category_confidence: quizSummary.category_confidence,
  };

  return db.ai_diagnostics.create({
    data: {
      user_id: userId,
      user_habit_id: userHabitId || null,
      raw_input: rawInput,
      model: "gpt-4o",
      parsed_summary: JSON.stringify({
        type: "quiz_summary",
        data: quizSummary,
        user_answers: userAnswers || null,
      }),
      scores: scores as Prisma.InputJsonValue,
    },
  });
}

/**
 * Store safety assessment data
 */
export async function storeSafetyAssessment(
  userId: string,
  userHabitId: string | undefined,
  rawInput: string,
  safety: SafetyData
) {
  return db.ai_diagnostics.create({
    data: {
      user_id: userId,
      user_habit_id: userHabitId || null,
      raw_input: rawInput,
      model: "gpt-4o",
      parsed_summary: JSON.stringify({
        type: "safety_assessment",
        data: safety,
      }),
      scores: {
        risk_level: safety.risk,
        blocked: safety.action === "block_and_escalate",
      } as Prisma.InputJsonValue,
    },
  });
}

/**
 * Store 21-day plan data
 */
export async function store21DayPlan(
  userId: string,
  userHabitId: string | undefined,
  rawInput: string,
  plan: Plan21DData
) {
  return db.ai_diagnostics.create({
    data: {
      user_id: userId,
      user_habit_id: userHabitId || null,
      raw_input: rawInput,
      model: "gpt-4o",
      parsed_summary: JSON.stringify({
        type: "plan_21d",
        data: plan,
      }),
      scores: {
        total_days: Object.keys(plan.day_tasks).length,
      } as Prisma.InputJsonValue,
    },
  });
}

/**
 * Get diagnostics for a user
 */
export async function getUserDiagnostics(
  userId: string,
  options?: {
    userHabitId?: string | undefined;
    type?: "quiz_form" | "quiz_summary" | "safety_assessment" | "plan_21d" | undefined;
    limit?: number | undefined;
  }
) {
  const diagnostics = await db.ai_diagnostics.findMany({
    where: {
      user_id: userId,
      ...(options?.userHabitId && { user_habit_id: options.userHabitId }),
    },
    orderBy: { created_at: "desc" },
    take: options?.limit || 50,
  });

  // Filter by type if specified
  if (options?.type) {
    return diagnostics.filter(d => {
      if (!d.parsed_summary) return false;
      try {
        const parsed = JSON.parse(d.parsed_summary);
        return parsed.type === options.type;
      } catch {
        return false;
      }
    });
  }

  return diagnostics;
}

/**
 * Get a specific diagnostic by ID
 */
export async function getDiagnosticById(userId: string, diagnosticId: string) {
  return db.ai_diagnostics.findFirst({
    where: {
      id: diagnosticId,
      user_id: userId,
    },
  });
}

/**
 * Get the latest diagnostic of a specific type for a habit
 */
export async function getLatestDiagnostic(
  userId: string,
  userHabitId: string,
  type: "quiz_form" | "quiz_summary" | "safety_assessment" | "plan_21d"
) {
  const diagnostics = await db.ai_diagnostics.findMany({
    where: {
      user_id: userId,
      user_habit_id: userHabitId,
    },
    orderBy: { created_at: "desc" },
  });

  for (const d of diagnostics) {
    if (!d.parsed_summary) continue;
    try {
      const parsed = JSON.parse(d.parsed_summary);
      if (parsed.type === type) {
        return {
          ...d,
          parsed_data: parsed.data,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

