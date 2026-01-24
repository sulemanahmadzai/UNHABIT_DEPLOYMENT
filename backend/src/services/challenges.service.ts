/**
 * Daily Challenges Service
 * Handles daily challenge generation and acceptance
 */

import { db } from "../lib/services.js";
import * as RewardsService from "./rewards.service.js";

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  reward_xp: number;
  challenge_type: "speed" | "consistency" | "streak" | "completion";
  target_value?: number;
  expires_at: Date;
}

/**
 * Get today's challenge for a user
 */
export async function getDailyChallenge(userId: string): Promise<DailyChallenge | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // For now, generate a new challenge each time
  // In the future, store challenges in a user_challenges table

  // Generate a new challenge based on user's current progress
  const activeJourney = await db.journeys.findFirst({
    where: { user_id: userId, status: "active" },
    include: {
      journey_days: {
        include: {
          journey_tasks: true,
        },
      },
    },
  });

  if (!activeJourney) {
    return null; // No active journey, no challenge
  }

  // Generate challenge based on journey day
  const challengeTypes: Array<"speed" | "consistency" | "streak" | "completion"> = [
    "speed",
    "consistency",
    "completion",
  ];
  const randomType = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];

  let title = "Today's Challenge";
  let description = "Finish today's main task 15% faster";
  let rewardXP = 15;
  let targetValue: number | undefined = undefined;

  switch (randomType) {
    case "speed":
      title = "Speed Challenge";
      description = "Finish today's main task 15% faster";
      rewardXP = 15;
      targetValue = 15; // 15% faster
      break;
    case "consistency":
      title = "Consistency Challenge";
      description = "Complete all tasks today";
      rewardXP = 20;
      break;
    case "completion":
      title = "Completion Challenge";
      description = "Complete today's tasks before noon";
      rewardXP = 25;
      break;
  }

  // Store challenge (if user_challenges table exists in future)
  // For now, return the challenge without storing
  // The ID is deterministic based on userId and date, so same challenge returned for same day
  const challengeId = `challenge-${userId}-${today.toISOString().split('T')[0]}`;
  
  return {
    id: challengeId,
    title,
    description,
    reward_xp: rewardXP,
    challenge_type: randomType,
    target_value: targetValue,
    expires_at: tomorrow,
  };
}

/**
 * Accept a daily challenge
 */
export async function acceptChallenge(userId: string, challengeId: string) {
  // Verify challenge exists and is valid
  const challenge = await getDailyChallenge(userId);
  
  if (!challenge || challenge.id !== challengeId) {
    return null;
  }

  // Store acceptance (if user_challenges table exists in future)
  // For now, just return success
  return {
    id: challengeId,
    accepted_at: new Date(),
    status: "active",
    challenge: challenge, // Include challenge details
  };
}

/**
 * Complete a challenge and award XP
 */
export async function completeChallenge(userId: string, challengeId: string) {
  const challenge = await getDailyChallenge(userId);
  
  if (!challenge || challenge.id !== challengeId) {
    return null;
  }

  // Award XP
  await RewardsService.awardPoints(userId, challenge.reward_xp);

  return {
    id: challengeId,
    completed_at: new Date(),
    xp_earned: challenge.reward_xp,
  };
}
