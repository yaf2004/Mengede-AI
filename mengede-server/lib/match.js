// Did the money go to the mentor? Receipts mask account numbers ("1****0000", "2519****3344"),
// so we compare the digits that are visible, and always require the name to match as well —
// amount + "some payment happened" is not the same as "this mentor was paid".

const MASK = /[*xX•·#]+/;
const digits = (s) => String(s ?? '').replace(/\D/g, '');

// Ethiopian mobile numbers appear as 09xxxxxxxx, +2519xxxxxxxx or 2519xxxxxxxx.
function toInternational(value) {
  const s = String(value ?? '').replace(/[\s()+-]/g, '');
  return /^0/.test(s) ? `251${s.slice(1)}` : s;
}

// -> 'exact' | 'masked' (enough digits visible to be convincing) | 'weak' (few digits visible,
//    so the name has to carry the check) | 'mismatch'
export function matchAccount(receiptAccount, expectedAccount) {
  const expected = digits(toInternational(expectedAccount));
  let seen = String(receiptAccount ?? '').split('(')[0]; // drop trailing "(card no)" style notes
  seen = toInternational(seen);
  if (!expected || !seen) return 'mismatch';

  if (!MASK.test(seen)) return digits(seen) === expected ? 'exact' : 'mismatch';

  const parts = seen.split(new RegExp(MASK.source, 'g'));
  const prefix = digits(parts[0]);
  const suffix = digits(parts[parts.length - 1]);
  const visible = prefix.length + suffix.length;
  if (visible === 0 || visible > expected.length) return 'mismatch';
  if (!expected.startsWith(prefix) || !expected.endsWith(suffix)) return 'mismatch';
  return visible >= 6 ? 'masked' : 'weak';
}

const nameTokens = (s) =>
  String(s ?? '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(t => t.length > 1);

// Every word of the registered holder name must appear in the receipt's recipient name.
// ("Selam Girma" matches "SELAM GIRMA ABEBE"; a receipt naming someone else does not.)
export function nameMatches(receiptName, holderName) {
  const want = nameTokens(holderName);
  const have = new Set(nameTokens(receiptName));
  return want.length > 0 && have.size > 0 && want.every(t => have.has(t));
}
