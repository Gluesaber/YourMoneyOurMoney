// Integration point 9 — docs/sprints/sprint-1/F-04-transactions.md §5 "Money conversion".
// The API speaks integer satang (BR-03); people type and read baht. Conversion is done on the digits as
// text, never with parseFloat(x) * 100, which drifts (parseFloat("19.99") * 100 = 1998.9999999999998).

const MAX_SATANG = 2_147_483_647;

// Plain digits ("1500") or digits grouped by thousands ("1,500"), then up to two decimals.
const BAHT = /^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/;

// "1,500.50" → 150050. Returns null for empty, negative, more than two decimals, badly placed commas,
// non-numeric input, or more than the largest storable amount.
export function toSatang(baht: string): number | null {
  const text = baht.trim();
  if (!BAHT.test(text)) return null;
  const [whole, fraction = ""] = text.replace(/,/g, "").split(".");
  const satang = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return satang <= MAX_SATANG ? satang : null;
}

// 150050 → "1,500.50"; negatives keep their sign.
export function formatBaht(satang: number): string {
  const sign = satang < 0 ? "-" : "";
  const abs = Math.abs(satang);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}
