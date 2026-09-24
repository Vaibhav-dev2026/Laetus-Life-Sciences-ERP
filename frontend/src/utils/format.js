import dayjs from 'dayjs';

export function formatCurrency(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

export function formatNumber(value, decimals = 2) {
  const n = Number(value || 0);
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatDate(value, fmt = 'DD-MM-YYYY') {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format(fmt) : '-';
}

export function formatDateTime(value) {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('DD-MM-YYYY hh:mm A') : '-';
}

export function daysBetween(from, to = dayjs()) {
  return dayjs(to).diff(dayjs(from), 'day');
}

export function amountInWords(amount) {
  const num = Math.round(Number(amount || 0));
  if (num === 0) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }
  function threeDigits(n) {
    if (n >= 100) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
    return twoDigits(n);
  }

  let n = num;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const rest = n;

  let parts = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(threeDigits(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (rest) parts.push(threeDigits(rest));

  return `Rupees ${parts.join(' ')} Only`;
}
