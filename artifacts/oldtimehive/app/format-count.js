/** Compact public counts. Do not use this for balances, prices, dates or ratings. */
export function formatCount(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  if (!Number.isFinite(n)) return "0";
  if (n < 1000) return String(n);
  const [unit, suffix] = n >= 1e9 ? [1e9, "b"] : n >= 1e6 ? [1e6, "m"] : [1000, "k"];
  const count = Math.floor(n / unit * 10) / 10;
  return `${Number.isInteger(count) ? count : count.toFixed(1)}${suffix}`;
}
