import dayjs from "dayjs";

export function formatCurrency(value) {
  const num = Number(value) || 0;
  return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

export function formatDate(value, fmt = "DD-MMM-YYYY") {
  if (!value) return "-";
  const d = dayjs(value);
  return d.isValid() ? d.format(fmt) : value;
}

export function formatDateTime(value) {
  if (!value) return "-";
  const d = dayjs(value);
  return d.isValid() ? d.format("DD-MMM-YYYY HH:mm") : value;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function threeDigits(n) {
  if (n >= 100) return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigits(n % 100) : "");
  return twoDigits(n);
}

export function numberToWordsINR(amount) {
  const rounded = Math.round(Number(amount) || 0);
  if (rounded === 0) return "Zero Rupees Only";
  let n = rounded;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;

  let words = "";
  if (crore) words += threeDigits(crore) + " Crore ";
  if (lakh) words += threeDigits(lakh) + " Lakh ";
  if (thousand) words += threeDigits(thousand) + " Thousand ";
  if (hundred) words += threeDigits(hundred);

  return words.trim() + " Rupees Only";
}
