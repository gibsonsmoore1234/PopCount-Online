import { describe, expect, it } from "vitest";
import { auraTier, computeAura, formatAura, percentileBadge, roundTenth } from "@/lib/aura";

describe("Aura math", () => {
  it("is the plain mean of 0–100 ratings (spec example: 45, 88, 20, 77, 90 → 64)", () => {
    const votes = [45, 88, 20, 77, 90];
    expect(
      computeAura(
        votes.reduce((a, b) => a + b, 0),
        votes.length,
      ),
    ).toBe(64);
  });

  it("weights boosted ratings", () => {
    // 100 with weight 3 + 0 with weight 1 → 300 / 4 = 75
    expect(computeAura(100 * 3 + 0 * 1, 4)).toBe(75);
  });

  it("rounds to tenths and is null without votes", () => {
    expect(computeAura(200, 3)).toBe(66.7);
    expect(computeAura(0, 0)).toBeNull();
    expect(roundTenth(88.44)).toBe(88.4);
  });

  it("matches the classic up/(up+down) when thumbs are 100 / 0", () => {
    const up = 512;
    const down = 19;
    expect(computeAura(up * 100, up + down)).toBe(roundTenth((up / (up + down)) * 100));
  });
});

describe("Aura tiers", () => {
  it.each([
    [100, "high"],
    [67, "high"],
    [66.96, "high"], // displays as 67.0 → green
    [66.9, "mid"],
    [34, "mid"],
    [33.9, "low"],
    [0, "low"],
    [null, "none"],
  ] as const)("%s → %s", (score, tier) => {
    expect(auraTier(score)).toBe(tier);
  });

  it("formats with exactly one decimal", () => {
    expect(formatAura(88.4)).toBe("88.4%");
    expect(formatAura(70)).toBe("70.0%");
    expect(formatAura(null)).toBe("—");
  });
});

describe("percentile badges", () => {
  it("awards top and bottom placements", () => {
    expect(percentileBadge(1, 100)?.id).toBe("top-1");
    expect(percentileBadge(5, 100)?.id).toBe("top-5");
    expect(percentileBadge(10, 100)?.id).toBe("top-10");
    expect(percentileBadge(50, 100)).toBeNull();
    expect(percentileBadge(95, 100)?.id).toBe("bottom-10");
    expect(percentileBadge(1, 5)).toBeNull(); // too few to be meaningful
  });
});
