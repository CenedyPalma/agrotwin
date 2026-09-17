import { aggregateShares, overallHealth, sharesFromPercents } from "@/utils/health";

describe("overallHealth", () => {
  it("is neutral without analysis", () => {
    expect(overallHealth(null).tier).toBe("neutral");
  });
  it("matches the live survey (66 / 32.2 / 1.7) as mostly healthy", () => {
    expect(overallHealth({ healthy: 66, attention: 32.2, problem: 1.7 })).toEqual({ tier: "healthy", label: "Mostly Healthy" });
  });
  it("flags problem when the problem share is large", () => {
    expect(overallHealth({ healthy: 70, attention: 10, problem: 20 }).tier).toBe("problem");
  });
  it("needs attention in between", () => {
    expect(overallHealth({ healthy: 45, attention: 50, problem: 5 }).tier).toBe("attention");
  });
});

describe("sharesFromPercents / aggregateShares", () => {
  it("returns null when any share is missing", () => {
    expect(sharesFromPercents(66, null, 2)).toBeNull();
  });
  it("area-weights fields and skips unanalysed ones", () => {
    const agg = aggregateShares([
      { shares: { healthy: 100, attention: 0, problem: 0 }, weight: 1 },
      { shares: { healthy: 0, attention: 100, problem: 0 }, weight: 3 },
      { shares: null, weight: 10 },
    ]);
    expect(agg).toEqual({ healthy: 25, attention: 75, problem: 0 });
  });
});
