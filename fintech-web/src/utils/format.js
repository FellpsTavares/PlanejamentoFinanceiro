export function formatDecimalStringToBRL(value, decimals = 2) {
  if (value === null || value === undefined || value === '') return 'R$ 0,00';
  let s = String(value).trim();
  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(',', '.');

  // accept numeric strings like '123.45' or integer strings
  if (!/^[0-9]+(\.[0-9]+)?$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return negative ? '-R$ 0,00' : 'R$ 0,00';
    s = n.toFixed(decimals);
  }

  const parts = s.split('.');
  let intPart = parts[0] || '0';
  let fracPart = parts[1] || '';

  if (decimals > 0) {
    if (fracPart.length > decimals) {
      // truncate (no rounding)
      fracPart = fracPart.slice(0, decimals);
    }
    fracPart = (fracPart + '0'.repeat(decimals)).slice(0, decimals);
  } else {
    fracPart = '';
  }

  // thousand separator: use dot for BR locale
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const formatted = decimals > 0 ? `${intPart},${fracPart}` : `${intPart}`;
  return (negative ? '-R$ ' : 'R$ ') + formatted;
}

export function formatDecimalString(value, decimals = 2) {
  if (value === null || value === undefined || value === '') return (decimals > 0) ? `0,${'0'.repeat(decimals)}` : '0';
  let s = String(value).trim();
  s = s.replace(',', '.');
  if (!/^[0-9]+(\.[0-9]+)?$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return (decimals > 0) ? `0,${'0'.repeat(decimals)}` : '0';
    s = n.toFixed(decimals);
  }
  const negative = s.startsWith('-');
  if (negative) s = s.slice(1);
  const parts = s.split('.');
  let intPart = parts[0] || '0';
  let fracPart = parts[1] || '';
  if (decimals > 0) {
    fracPart = (fracPart + '0'.repeat(decimals)).slice(0, decimals);
  }
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (negative ? '-' : '') + (decimals > 0 ? `${intPart},${fracPart}` : `${intPart}`);
}

export function normalizeInputDecimal(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\./g, '').replace(/,/g, '.');
}

export function formatQuantityDisplay(value) {
  if (value === null || value === undefined || value === '') return '';
  const s = String(value).trim();
  let n = Number(s);
  if (Number.isNaN(n)) n = Number(s.replace(',', '.'));
  if (Number.isNaN(n)) n = Number(s.replace(/\./g, '').replace(',', '.'));
  if (Number.isNaN(n)) return s;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.?0+$/, '');
}
