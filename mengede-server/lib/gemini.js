import 'dotenv/config';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function interact({ input, model } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const usedModel = model || process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  if (!apiKey) {
    // Return a safe simulated response for local development when key is missing.
    return {
      ok: true,
      simulated: true,
      model: usedModel,
      response: { content: `Simulated Gemini response for input: ${String(input)}` },
    };
  }

  const url = `${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`;

  const body = {
    model: usedModel,
    /// Keep store false to avoid persistence on Google's side
    input: { text: String(input || '') },
    responseFormat: {
      type: 'json_schema',
      jsonSchema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          content: { type: 'string' }
        },
        required: ['content']
      }
    },
    options: { store: false },
    generation: { thinking_level: 'low' }
  };

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // keep timeout controlled by caller / environment
      });

      if (res.status === 200) {
        const data = await res.json();
        return { ok: true, simulated: false, model: usedModel, response: data };
      }

      // Retry on rate limits and server errors
      if (res.status === 429 || res.status >= 500) {
        const delay = attempt * 1000;
        await sleep(delay);
        continue;
      }

      // Non-retriable error
      const text = await res.text();
      return { ok: false, status: res.status, error: text };
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await sleep(attempt * 1000);
    }
  }

  return { ok: false, error: 'Exceeded retry attempts' };
}
