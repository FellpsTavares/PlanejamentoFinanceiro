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
  const s = String(value).trim();
  // Formato BR com vírgula decimal: pontos são separadores de milhar → remover; vírgula → ponto
  if (s.includes(',')) {
    return s.replace(/\./g, '').replace(/,/g, '.');
  }
  // Sem vírgula mas com ponto: pode ser separador de milhar BR (ex: "1.000") ou decimal EN (ex: "1.5")
  // Heurística: se o último segmento após ponto tem exatamente 3 dígitos e todos os segmentos são numéricos,
  // é separador de milhar BR (Cleave.js formata assim).
  if (s.includes('.')) {
    const parts = s.split('.');
    const allDigits = parts.every((p) => /^\d+$/.test(p));
    const lastHasThree = parts[parts.length - 1].length === 3;
    if (allDigits && lastHasThree) {
      // Ex: "1.000" → "1000", "1.000.000" → "1000000"
      return parts.join('');
    }
    // Caso contrário: ponto como decimal (formato interno/EN), ex: "1.5", "1000.00"
    return s;
  }
  return s;
}

export function formatQuantityDisplay(value) {
  if (value === null || value === undefined || value === '') return '';
  const s = String(value).trim();
  let n = Number(s);
  if (Number.isNaN(n)) n = Number(s.replace(',', '.'));
  if (Number.isNaN(n)) n = Number(s.replace(/\./g, '').replace(',', '.'));
  if (Number.isNaN(n)) return s;
  if (Number.isInteger(n)) return String(n);
  // format with up to 3 decimals, using comma as decimal separator (BR)
  const with3 = n.toFixed(3).replace(/\.?0+$/, '');
  return with3.replace('.', ',');
}
