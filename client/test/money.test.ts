import { formatBaht, toSatang } from "../src/lib/money.js";

// Integration point 9 — docs/sprints/sprint-1/F-04-transactions.md §5 "Money conversion".
describe("toSatang (T-MONEY-UNIT-01)", () => {
  it.each([
    ["1500", 150_000],
    ["1,500", 150_000],
    ["1500.5", 150_050],
    ["1,500.50", 150_050],
    ["0.01", 1],
    ["0", 0],
    [" 12.30 ", 1_230],
    ["21,474,836.47", 2_147_483_647],
  ])("%j → %i", (text, satang) => {
    expect(toSatang(text)).toBe(satang);
  });

  it.each(["", "   ", "-1", "1.234", "abc", "1,50", "12,3456", "1.2.3", "21,474,836.48", "1e3"])(
    "%j → null",
    (text) => {
      expect(toSatang(text)).toBeNull();
    },
  );

  it("never drifts the way floating point does (0.1 + 0.2)", () => {
    expect(toSatang("0.10")! + toSatang("0.20")!).toBe(toSatang("0.30"));
    expect(toSatang("19.99")).toBe(1_999); // parseFloat("19.99") * 100 = 1998.9999999999998
  });
});

describe("formatBaht (T-MONEY-UNIT-02)", () => {
  it.each([
    [150_050, "1,500.50"],
    [0, "0.00"],
    [-150_000, "-1,500.00"],
    [2_147_483_647, "21,474,836.47"],
    [5, "0.05"],
  ])("%i → %j", (satang, text) => {
    expect(formatBaht(satang)).toBe(text);
  });

  it("round-trips through toSatang", () => {
    for (const satang of [0, 1, 99, 100, 150_050, 2_147_483_647]) {
      expect(toSatang(formatBaht(satang))).toBe(satang);
    }
  });
});
