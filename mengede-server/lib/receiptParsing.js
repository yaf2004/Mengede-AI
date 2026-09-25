// links.et returns a per-provider `receipt` shape (see https://links.et/docs/verify.md).
// Per their own docs: "Switch on receipt.source, never on the host" and "Amount fields
// are numbers on some providers and strings on others. Never feed them straight into
// arithmetic." This file is the one place that knows those per-provider differences so
// the rest of the app can just ask for { bank, amount }.

// Friendly names keyed by receipt.source. Only the six sources documented in detail on
// links.et/docs/verify.md have confirmed field shapes below; the rest are named from
// links.et/agents.md's provider table but their exact field layout isn't in the public
// docs yet, so we fall back to best-effort generic parsing for those (see extractAmount).
const BANK_NAMES_BY_SOURCE = {
  'telebirr-html': 'Telebirr',
  'cbe-pdf': 'Commercial Bank of Ethiopia (CBE)',
  'mb-json': 'Commercial Bank of Ethiopia (CBE Mobile Banking)',
  'cbebirr-pdf': 'CBE Birr',
  'boa-json': 'Bank of Abyssinia',
  'zemen-pdf': 'Zemen Bank',
  'awash-html': 'Awash Bank',
  'dashen-pdf': 'Dashen Bank',
  'dashen-html': 'Dashen Bank (Super App)',
  'mpesa-pdf': 'M-PESA',
  'ebirr-html': 'Ebirr (COOPay / Kaafi)',
  'amhara-json': 'Amhara Bank',
  'abay-html': 'Abay Bank',
  'berhan-pdf': 'Berhan Bank',
  'oromia-pdf': 'Oromia Bank',
  'ahadu-pdf': 'Ahadu Bank',
  'siinqee-pdf': 'Siinqee Bank',
  'zamzam-json': 'ZamZam Bank',
  'hulubeje-dxxrdv': 'HuluBeje (point of sale)',
};

// Sources whose receipts are view-limited (Siinqee: ~5 views total per link, per
// links.et/agents.md). Never re-fetch/retry one of these automatically.
const METERED_SOURCES = new Set(['siinqee-pdf']);

/** Pulls the first number out of a string like "100 Birr" or "100 ETB". */
function parseLeadingNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;
  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

/**
 * Returns the transferred amount (excluding fees/VAT) as a plain number in ETB, or
 * `undefined` if this source's amount field isn't confirmed against the docs yet.
 */
function extractAmount(receipt) {
  if (!receipt) return undefined;
  switch (receipt.source) {
    case 'telebirr-html':
      return parseLeadingNumber(receipt.settledAmount); // e.g. "100 Birr"
    case 'cbe-pdf':
    case 'mb-json':
      return typeof receipt.transferredAmount === 'number' ? receipt.transferredAmount : undefined;
    case 'zemen-pdf':
      return typeof receipt.settledAmount === 'number' ? receipt.settledAmount : undefined;
    case 'boa-json':
      return typeof receipt.transferredAmount === 'number' ? receipt.transferredAmount : undefined;
    case 'awash-html':
      return parseLeadingNumber(receipt.transaction?.amount); // e.g. "100 ETB"
    default:
      // Unconfirmed provider shape — best-effort guess across the field names the
      // documented providers use, rather than asserting a value we can't verify.
      return parseLeadingNumber(
        receipt.transferredAmount ?? receipt.settledAmount ?? receipt.totalAmount ?? receipt.amount ?? receipt.transaction?.amount
      );
  }
}

/** Human-readable bank/wallet name for a links.et receipt. */
function extractBankName(receipt, providerKey) {
  if (receipt?.source && BANK_NAMES_BY_SOURCE[receipt.source]) return BANK_NAMES_BY_SOURCE[receipt.source];
  if (providerKey) return providerKey; // better than nothing if we hit an undocumented source
  return 'Unrecognized bank — verify manually';
}

function isMeteredSource(source) {
  return METERED_SOURCES.has(source);
}

const isCompletedStatus = (status) => /^(completed|success)$/i.test(String(status ?? '').trim());

/**
 * Who actually got paid, for the six sources with confirmed field shapes. This is what makes
 * verification mean "this mentor was paid" rather than "some payment for this amount exists
 * somewhere" — without it, a valid receipt for the right amount paid to a stranger would pass.
 * Returns `{ receiverName, receiverAccount, completed }` with empty/`true` defaults for sources
 * we don't recognize; callers should treat an unrecognized source as unverifiable, not as a pass.
 */
function extractReceiver(receipt) {
  switch (receipt?.source) {
    case 'telebirr-html':
      return {
        receiverName: receipt.creditedPartyName,
        receiverAccount: receipt.creditedPartyAccountNo,
        completed: isCompletedStatus(receipt.transactionStatus),
      };
    case 'cbe-pdf':
    case 'mb-json':
      return {
        receiverName: receipt.receiverName,
        receiverAccount: receipt.receiverAccount,
        completed: true, // links.et already rejects (502) a CBE receipt that doesn't validate
      };
    case 'zemen-pdf':
      return {
        receiverName: receipt.recipientName,
        receiverAccount: receipt.recipientAccount,
        completed: isCompletedStatus(receipt.transactionStatus),
      };
    case 'boa-json':
      return {
        receiverName: receipt.receiverName,
        receiverAccount: receipt.receiverAccount,
        completed: isCompletedStatus(receipt.upstreamStatus),
      };
    case 'awash-html':
      return {
        receiverName: receipt.transaction?.beneficiaryName,
        receiverAccount: receipt.transaction?.beneficiaryAccount,
        completed: true,
      };
    default:
      return { receiverName: '', receiverAccount: '', completed: false };
  }
}

/** Currency for the sources whose amount field is confirmed (see extractAmount). */
function extractCurrency(receipt) {
  if (receipt?.currency) return String(receipt.currency).toUpperCase();
  // telebirr/awash amounts are strings like "100 Birr" — parseLeadingNumber strips the unit,
  // but everywhere links.et documents an amount without an explicit currency field, it's ETB.
  if (['telebirr-html', 'awash-html'].includes(receipt?.source)) return 'ETB';
  return null;
}

/**
 * Normalizes a links.et `verify()` success result into the shape the rest of the app
 * wants: { bank, amount, amountConfirmed, reference, source, providerKey }.
 * `amountConfirmed` is false when we couldn't confidently parse this provider's amount
 * field — callers should not silently treat that as "any amount is fine".
 */
export function normalizeReceipt(result) {
  const receipt = result?.receipt || {};
  const amount = extractAmount(receipt);
  const receiver = extractReceiver(receipt);
  return {
    bank: extractBankName(receipt, result?.providerKey),
    amount,
    amountConfirmed: amount !== undefined,
    currency: extractCurrency(receipt),
    reference: receipt.receiptNo || receipt.reference || receipt.transactionReference || null,
    source: receipt.source || null,
    providerKey: result?.providerKey || null,
    metered: isMeteredSource(receipt.source),
    receiverName: receiver.receiverName || '',
    receiverAccount: receiver.receiverAccount || '',
    // Whether we could confirm this receipt names a receiver at all — false for sources not
    // covered by extractReceiver(), which should never be treated as "receiver verified".
    receiverConfirmed: Boolean(BANK_NAMES_BY_SOURCE[receipt.source] && receiver.receiverAccount),
    completed: receiver.completed,
  };
}
