import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalKey;
  }
});

test('interact returns a simulated response when Gemini is not configured', async () => {
  delete process.env.GEMINI_API_KEY;

  const { interact } = await import('../lib/gemini.js?test=simulated');

  const result = await interact({
    input: 'hello',
  });

  assert.equal(result.ok, true);
  assert.equal(result.simulated, true);
  assert.match(result.output_text, /Gemini is not configured yet/);
});

test('interact parses structured JSON and URL citations', async () => {
  process.env.GEMINI_API_KEY = 'test-key';

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        status: 'completed',
        output_text: '{"content":"hello"}',
        steps: [
          {
            type: 'model_output',
            content: [
              {
                type: 'text',
                text: '{"content":"hello"}',
                annotations: [
                  {
                    type: 'url_citation',
                    title: 'Example',
                    url: 'https://example.com',
                  },
                ],
              },
            ],
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );

  const { interact } = await import('../lib/gemini.js?test=success');

  const result = await interact({
    input: 'hello',
    useSearch: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.simulated, false);
  assert.equal(result.output_text, '{"content":"hello"}');
  assert.deepEqual(result.sources, [
    {
      title: 'Example',
      url: 'https://example.com',
    },
  ]);
});

test('interact exposes quota exhaustion for assistant fallback', async () => {
  process.env.GEMINI_API_KEY = 'test-key';

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          message: 'quota exceeded',
        },
      }),
      {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }
    );

  const { interact } = await import('../lib/gemini.js?test=quota');

  const result = await interact({
    input: 'hello',
    useSearch: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 429);
  assert.equal(result.quota_exceeded, true);
});
