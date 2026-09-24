// Consistent 2-decimal, round-half-up money handling to avoid floating-point
// accumulation errors across GST and invoice calculations.
function round2(value) {
  const n = Number(value) || 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sum(items, key) {
  return round2(items.reduce((acc, item) => acc + (Number(item[key]) || 0), 0));
}

module.exports = { round2, sum };
