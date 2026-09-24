import { Router } from 'express';

const router = Router();

// Duplicate-receipt guard. In-memory only — it resets on every restart and won't be shared
// across multiple server instances. Replace with a real table/collection (e.g. a MongoDB
// collection keyed on the normalized reference) before this goes live.
const usedReceipts = new Map(); // normalizedReference -> { at: ISOString }

function guessBank(ref) {
  const r = ref.toLowerCase();
  if (r.includes('telebirr')) return 'Telebirr';
  if (r.includes('cbe')) return 'Commercial Bank of Ethiopia (CBE)';
  if (r.includes('boa') || r.includes('abyssinia')) return 'Bank of Abyssinia';
  if (r.includes('dashen')) return 'Dashen Bank';
  if (r.includes('awash')) return 'Awash Bank';
  return 'Unrecognized bank — verify manually';
}

router.post('/', async (req, res) => {
  const { reference, expectedAmount } = req.body || {};
  const ref = typeof reference === 'string' ? reference.trim() : '';

  if (!ref) {
    return res.status(400).json({ ok: false, error: 'Paste the receipt link or reference first.' });
  }
  if (ref.length < 8) {
    return res.status(400).json({ ok: false, error: 'That reference looks too short — paste the full link or code.' });
  }

  const key = ref.toLowerCase();
  if (usedReceipts.has(key)) {
    return res.status(409).json({ ok: false, error: 'This receipt has already been used for another booking.' });
  }

  // ---------------------------------------------------------------------------------
  // MOCK VERIFICATION. Replace everything below this line with a real call to Links.et:
  //
  //   const linksRes = await fetch('https://api.links.et/v1/verify', {
  //     method: 'POST',
  //     headers: {
  //       'Authorization': `Bearer ${process.env.LINKS_ET_API_KEY}`,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({ reference: ref }),
  //   });
  //   if (!linksRes.ok) return res.status(502).json({ ok:false, error:'Could not reach the bank right now.' });
  //   const data = await linksRes.json(); // { bank, amount, reference, verified }
  //   if (!data.verified) return res.status(400).json({ ok:false, error:'We could not verify that receipt.' });
  //
  // The LINKS_ET_API_KEY must only ever live here (server-side / .env), never in the frontend.
  // ---------------------------------------------------------------------------------
  await new Promise(r => setTimeout(r, 700)); // simulate network latency to the bank

  const bank = guessBank(ref);
  // A real Links.et response reports its own amount — this mock has no such signal, so it
  // assumes the student paid the correct amount. Swap this line for `data.amount` above, and
  // the comparison right after it is the actual amount check the mock was missing before.
  const reportedAmount = expectedAmount;

  if (typeof expectedAmount === 'number' && reportedAmount !== expectedAmount) {
    return res.status(400).json({
      ok: false,
      error: `The bank reports ETB ${reportedAmount.toLocaleString()}, which doesn't match the ETB ${expectedAmount.toLocaleString()} expected for this session.`,
    });
  }

  usedReceipts.set(key, { at: new Date().toISOString() });

  return res.json({ ok: true, bank, amount: reportedAmount, reference: ref });
});

export default router;
