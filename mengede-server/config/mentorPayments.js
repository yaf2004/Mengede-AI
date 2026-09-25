// Who gets paid, and how much. The server owns this: the browser never decides the price or
// the recipient, so a student can't pay less, or pay someone else, and still get a booking.
// Keep `rate` equal to the price shown in mengede-web/src/data/mentors.js — that copy is
// display-only, this one is what actually gets checked and charged.
//
// Fill in `account` and `holderName` for each paid mentor before launch, copied from a real
// receipt:
//   account     Telebirr: the phone number (09xx or 2519xx). Bank: the full account number.
//   holderName  the name the bank shows on receipts, e.g. "Selam Girma". Every word in it must
//               appear in the receipt's recipient name.
// Until both are set, the mentor is "not configured" and paid bookings are refused up front —
// this is safer than falling back to skipping the check.
export const MENTOR_PAYMENTS = {
  selam: { name: 'Selam Girma', rate: 500, method: 'Telebirr', account: null, holderName: null },
  nathnael: { name: 'Nathnael Worku', rate: 350, method: 'CBE', account: null, holderName: null },
};

export const FREE_MENTORS = new Set(['hana']);

export function isConfigured(payment) {
  return Boolean(payment && payment.account && payment.holderName);
}
