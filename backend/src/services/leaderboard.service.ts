import { prisma } from "../lib/services.js";

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  avatar_url: string | null;
  score: number;
  streak: number;
  is_current_user: boolean;
}

/**
 * Get daily leaderboard (based on today's XP)
 */
export async function getDailyLeaderboard(userId: string, limit = 20): Promise<{
  entries: LeaderboardEntry[];
  current_user_rank: number | null;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get today's XP for all users
  const dailyXP = await prisma.points_ledger.groupBy({
    by: ["user_id"],
    where: {
      awarded_at: { gte: today },
    },
    _sum: { amount: true },
    orderBy: {
      _sum: { amount: "desc" },
    },
    take: limit,
  });

  // Get user profiles and streaks
  const userIds = dailyXP.map(d => d.user_id);
  const [profiles, streaks] = await Promise.all([
    prisma.profiles.findMany({
      where: { user_id: { in: userIds } },
    }),
    prisma.streaks.findMany({
      where: { user_id: { in: userIds }, kind: "task_completion" },
    }),
  ]);

  const profileMap = new Map(profiles.map(p => [p.user_id, p]));
  const streakMap = new Map(streaks.map(s => [s.user_id, s.current_length]));

  const entries: LeaderboardEntry[] = dailyXP.map((entry, index) => ({
    rank: index + 1,
    user_id: entry.user_id,
    name: profileMap.get(entry.user_id)?.full_name ?? "Anonymous",
    avatar_url: profileMap.get(entry.user_id)?.avatar_url ?? null,
    score: entry._sum.amount ?? 0,
    streak: streakMap.get(entry.user_id) ?? 0,
    is_current_user: entry.user_id === userId,
  }));

  // Find current user's rank
  let currentUserRank: number | null = entries.find(e => e.is_current_user)?.rank ?? null;

  // If current user not in top, get their rank
  if (!currentUserRank) {
    const userTodayXP = await prisma.points_ledger.aggregate({
      where: {
        user_id: userId,
        awarded_at: { gte: today },
      },
      _sum: { amount: true },
    });

    if (userTodayXP._sum.amount) {
      const higherCount = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT user_id) as count
        FROM public.points_ledger
        WHERE awarded_at >= ${today}
        GROUP BY user_id
        HAVING SUM(amount) > ${userTodayXP._sum.amount}
      `;
      currentUserRank = Number(higherCount[0]?.count ?? 0) + 1;
    }
  }

  return { entries, current_user_rank: currentUserRank };
}

/**
 * Get weekly leaderboard (based on weekly XP)
 */
export async function getWeeklyLeaderboard(userId: string, limit = 20): Promise<{
  entries: LeaderboardEntry[];
  current_user_rank: number | null;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  // Get weekly XP for all users
  const weeklyXP = await prisma.points_ledger.groupBy({
    by: ["user_id"],
    where: {
      awarded_at: { gte: startOfWeek },
    },
    _sum: { amount: true },
    orderBy: {
      _sum: { amount: "desc" },
    },
    take: limit,
  });

  const userIds = weeklyXP.map(d => d.user_id);
  const [profiles, streaks] = await Promise.all([
    prisma.profiles.findMany({
      where: { user_id: { in: userIds } },
    }),
    prisma.streaks.findMany({
      where: { user_id: { in: userIds }, kind: "task_completion" },
    }),
  ]);

  const profileMap = new Map(profiles.map(p => [p.user_id, p]));
  const streakMap = new Map(streaks.map(s => [s.user_id, s.current_length]));

  const entries: LeaderboardEntry[] = weeklyXP.map((entry, index) => ({
    rank: index + 1,
    user_id: entry.user_id,
    name: profileMap.get(entry.user_id)?.full_name ?? "Anonymous",
    avatar_url: profileMap.get(entry.user_id)?.avatar_url ?? null,
    score: entry._sum.amount ?? 0,
    streak: streakMap.get(entry.user_id) ?? 0,
    is_current_user: entry.user_id === userId,
  }));

  const currentUserRank = entries.find(e => e.is_current_user)?.rank ?? null;

  return { entries, current_user_rank: currentUserRank };
}

/**
 * Get friends (buddies) leaderboard
 */
export async function getFriendsLeaderboard(userId: string): Promise<{
  entries: LeaderboardEntry[];
  current_user_rank: number | null;
}> {
  // Get all buddy IDs
  const buddyLinks = await prisma.buddy_links.findMany({
    where: {
      OR: [
        { user_a: userId },
        { user_b: userId },
      ],
      status: "active",
    },
  });

  const buddyIds = buddyLinks.map(link =>
    link.user_a === userId ? link.user_b : link.user_a
  );

  // Include current user
  const allUserIds = [...buddyIds, userId];

  // Get combined scores (XP + streak * 10) for ranking
  const [balances, streaks, profiles] = await Promise.all([
    prisma.point_balances.findMany({
      where: { user_id: { in: allUserIds } },
    }),
    prisma.streaks.findMany({
      where: { user_id: { in: allUserIds }, kind: "task_completion" },
    }),
    prisma.profiles.findMany({
      where: { user_id: { in: allUserIds } },
    }),
  ]);

  const balanceMap = new Map(balances.map(b => [b.user_id, Number(b.total_points)]));
  const streakMap = new Map(streaks.map(s => [s.user_id, s.current_length]));
  const profileMap = new Map(profiles.map(p => [p.user_id, p]));

  // Calculate combined score: XP + (streak * 10) for tie-breaking
  const scores = allUserIds.map(uid => ({
    user_id: uid,
    xp: balanceMap.get(uid) ?? 0,
    streak: streakMap.get(uid) ?? 0,
    combined_score: (balanceMap.get(uid) ?? 0) + (streakMap.get(uid) ?? 0) * 10,
  }));

  // Sort by combined score
  scores.sort((a, b) => b.combined_score - a.combined_score);

  const entries: LeaderboardEntry[] = scores.map((entry, index) => ({
    rank: index + 1,
    user_id: entry.user_id,
    name: profileMap.get(entry.user_id)?.full_name ?? "Anonymous",
    avatar_url: profileMap.get(entry.user_id)?.avatar_url ?? null,
    score: entry.xp,
    streak: entry.streak,
    is_current_user: entry.user_id === userId,
  }));

  const currentUserRank = entries.find(e => e.is_current_user)?.rank ?? null;

  return { entries, current_user_rank: currentUserRank };
}

/**
 * Get current user's rank summary
 */
export async function getMyRank(userId: string) {
  const [daily, weekly, friends] = await Promise.all([
    getDailyLeaderboard(userId, 100),
    getWeeklyLeaderboard(userId, 100),
    getFriendsLeaderboard(userId),
  ]);

  const userEntry = friends.entries.find(e => e.is_current_user);

  return {
    daily_rank: daily.current_user_rank,
    weekly_rank: weekly.current_user_rank,
    friends_rank: friends.current_user_rank,
    total_friends: friends.entries.length - 1, // Exclude self
    user_stats: userEntry ? {
      score: userEntry.score,
      streak: userEntry.streak,
    } : null,
  };
}
