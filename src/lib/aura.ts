/**
 * Aura math & presentation rules — shared by the server, the client and the tests.
 *
 * Aura is the weighted arithmetic mean of every 0–100 rating a profile receives.
 * A free rating has weight 1; every paid boost click adds +1 weight to the booster's rating.
 *   e.g. ratings 45, 88, 20, 77, 90 → (45+88+20+77+90) / 5 = 64.0
 * Quick votes are ratings at the extremes: 🔥 Upvote = 100, 👎 Downvote = 0.
 */

export const AURA_COLORS = {
  high: "#22C55E",
  mid: "#FACC15",
  low: "#EF4444",
  none: "#3A3A40",
} as const;

export type AuraTier = keyof typeof AURA_COLORS;

export const UPVOTE_VALUE = 100;
export const DOWNVOTE_VALUE = 0;
/** Ratings at or above this value count toward the 🔥 tally, below it toward 👎. */
export const UP_THRESHOLD = 50;

/** Profiles need this many weighted votes before entering overall/bottom rankings and stickers. */
export const MIN_VOTES_FOR_RANKING = 3;

/** Boost economics: $0.01 per click, at most 10 clicks per profile per rolling 24h. */
export const BOOST_COST_CENTS = 1;
export const BOOST_DAILY_CAP = 10;
export const SIGNUP_GRANT_CENTS = 100;
/** Every action that adds something (rating, comment, profile, bubble) costs one click. */
export const ACTION_COST_CLICKS = 1;

export function roundTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeAura(ratingSum: number, voteCount: number): number | null {
  if (voteCount <= 0) return null;
  return roundTenth(ratingSum / voteCount);
}

/** Tier boundaries are evaluated on the displayed (tenths-rounded) score: 67.0–100 / 34.0–66.9 / 0–33.9. */
export function auraTier(score: number | null | undefined): AuraTier {
  if (score === null || score === undefined || Number.isNaN(score)) return "none";
  const s = roundTenth(score);
  if (s >= 67) return "high";
  if (s >= 34) return "mid";
  return "low";
}

export function auraColor(score: number | null | undefined): string {
  return AURA_COLORS[auraTier(score)];
}

export function formatAura(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return `${roundTenth(score).toFixed(1)}%`;
}

export function tierLabel(tier: AuraTier): string {
  return { high: "High", mid: "Mid", low: "Low", none: "Unrated" }[tier];
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("en-US");
}

/** Percentile badge for a national rank (1 = best) out of `total` eligible profiles. */
export function percentileBadge(rank: number, total: number): { id: string; label: string } | null {
  if (total < 10 || rank < 1) return null;
  const topPct = (rank / total) * 100;
  const bottomPct = ((total - rank + 1) / total) * 100;
  if (topPct <= 1) return { id: "top-1", label: "Top 1% Nationally" };
  if (topPct <= 5) return { id: "top-5", label: "Top 5% Nationally" };
  if (topPct <= 10) return { id: "top-10", label: "Top 10% Nationally" };
  if (bottomPct <= 10) return { id: "bottom-10", label: "Bottom 10% Nationally" };
  return null;
}
