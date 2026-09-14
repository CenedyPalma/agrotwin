import { cropLabel, formatArea, formatDate, formatNumber, formatPercent, greeting, plural, seasonOf } from "@/utils/format";

describe("format utils", () => {
  it("formats numbers with separators", () => {
    expect(formatNumber(1378)).toBe("1,378");
    expect(formatNumber(null)).toBe("—");
  });
  it("formats percentages honestly (one decimal only when needed)", () => {
    expect(formatPercent(66)).toBe("66%");
    expect(formatPercent(32.2)).toBe("32.2%");
    expect(formatPercent(1.7)).toBe("1.7%");
  });
  it("formats areas in m² and hectares", () => {
    expect(formatArea(320)).toBe("320 m²");
    expect(formatArea(12270)).toBe("1.23 ha");
  });
  it("formats dates and seasons", () => {
    expect(formatDate("2026-06-03T15:03:19")).toBe("June 3, 2026");
    expect(seasonOf("2026-06-03T15:03:19")).toBe("2026 Season");
    expect(formatDate(null)).toBe("Unknown date");
  });
  it("labels crops and plurals", () => {
    expect(cropLabel("soybean")).toBe("Soybean");
    expect(plural(1, "file")).toBe("1 file");
    expect(plural(2, "file")).toBe("2 files");
  });
  it("greets by time of day", () => {
    expect(greeting(new Date(2026, 8, 14, 8))).toBe("Good morning");
    expect(greeting(new Date(2026, 8, 14, 20))).toBe("Good evening");
  });
});
