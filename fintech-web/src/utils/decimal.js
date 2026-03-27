import { normalizeInputDecimal } from './format';

// Multiply two decimal-like strings (accepts commas) and return a normalized string with dot as decimal separator
export function multiplyDecimalStrings(a, b) {
  const sa = normalizeInputDecimal(a || '0');
  const sb = normalizeInputDecimal(b || '0');
  if (!sa || !sb) return '0';
  const [ai, af = ''] = sa.split('.');
  const [bi, bf = ''] = sb.split('.');
  const aDigits = (ai + af).replace(/^0+/, '') || '0';
  const bDigits = (bi + bf).replace(/^0+/, '') || '0';
  const aDec = af.length;
  const bDec = bf.length;
  const product = BigInt(aDigits) * BigInt(bDigits);
  const dec = aDec + bDec;
  let prodStr = product.toString();
  if (dec === 0) return prodStr;
  if (prodStr.length <= dec) prodStr = prodStr.padStart(dec + 1, '0');
  const intPart = prodStr.slice(0, prodStr.length - dec);
  const fracPart = prodStr.slice(prodStr.length - dec).replace(/0+$/,'');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

// Add two decimal strings
export function addDecimalStrings(a, b) {
  const na = normalizeInputDecimal(a || '0');
  const nb = normalizeInputDecimal(b || '0');
  const [ai, af = ''] = na.split('.');
  const [bi, bf = ''] = nb.split('.');
  const maxDec = Math.max(af.length, bf.length);
  const aInt = BigInt((ai + af).padEnd(ai.length + maxDec, '0'));
  const bInt = BigInt((bi + bf).padEnd(bi.length + maxDec, '0'));
  const sum = aInt + bInt;
  const sumStr = sum.toString();
  if (maxDec === 0) return sumStr;
  if (sumStr.length <= maxDec) return `0.${sumStr.padStart(maxDec,'0').replace(/0+$/,'')}`;
  const intPart = sumStr.slice(0, sumStr.length - maxDec);
  const fracPart = sumStr.slice(sumStr.length - maxDec).replace(/0+$/,'');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

// Subtract b from a (a - b)
export function subtractDecimalStrings(a, b) {
  const na = normalizeInputDecimal(a || '0');
  const nb = normalizeInputDecimal(b || '0');
  const [ai, af = ''] = na.split('.');
  const [bi, bf = ''] = nb.split('.');
  const maxDec = Math.max(af.length, bf.length);
  const aInt = BigInt((ai + af).padEnd(ai.length + maxDec, '0'));
  const bInt = BigInt((bi + bf).padEnd(bi.length + maxDec, '0'));
  const diff = aInt - bInt;
  const negative = diff < 0n;
  const abs = negative ? -diff : diff;
  const s = abs.toString();
  if (maxDec === 0) return (negative ? '-' : '') + s;
  if (s.length <= maxDec) return (negative ? '-' : '') + `0.${s.padStart(maxDec,'0').replace(/0+$/,'')}`;
  const intPart = s.slice(0, s.length - maxDec);
  const fracPart = s.slice(s.length - maxDec).replace(/0+$/,'');
  return (negative ? '-' : '') + (fracPart ? `${intPart}.${fracPart}` : intPart);
}

// Divide decimal string by integer divisor, returns decimal string truncated (no rounding)
export function divideDecimalStringByInt(a, divisor) {
  const na = normalizeInputDecimal(a || '0');
  const [ai, af = ''] = na.split('.');
  const digits = ai + af;
  const dec = af.length;
  const num = BigInt(digits);
  const quot = num / BigInt(divisor);
  const quotStr = quot.toString();
  if (dec === 0) return quotStr;
  if (quotStr.length <= dec) return `0.${quotStr.padStart(dec,'0').replace(/0+$/,'')}`;
  const intPart = quotStr.slice(0, quotStr.length - dec);
  const fracPart = quotStr.slice(quotStr.length - dec).replace(/0+$/,'');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}
