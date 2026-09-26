import 'dotenv/config';

const URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_SCHEMA = {
  type: 'object',
  properties: {
    content: {
      type: 'string'
    }
  },
  required: ['content']
};

function outputText(data) {
  return (
    data?.output_text ||
    data?.steps
      ?.find((step) => step.type === 'model_output')
      ?.content
      ?.find((content) => content.type === 'text')
      ?.text ||
    ''
  );
}

export async function interact({
  input,
  model,
  schema = DEFAULT_SCHEMA,
  useSearch = false
} = {}) {
  const key = process.env.GEMINI_API_KEY;
  const used = model || process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  if (!key) {
    return {
      ok: true,
      simulated: true,
      model: used,
      output_text: JSON.stringify({
        content:
          'Gemini is not configured yet. Set GEMINI_API_KEY to enable the live assistant.'
      }),
      sources: []
    };
  }

  const body = {
    model: used,
    input: String(input || ''),
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema
    },
    store: false
  };

  if (useSearch) {
    body.tools = [
      {
        type: 'google_search'
      }
    ];
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
          'Api-Revision': '2026-05-20'
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        const sources = [];

        for (const step of data.steps || []) {
          for (const content of step.content || []) {
            for (const annotation of content.annotations || []) {
              if (annotation.type === 'url_citation') {
                sources.push({
                  title: annotation.title || annotation.url,
                  url: annotation.url
                });
              }
            }
          }
        }

        return {
          ok: true,
          simulated: false,
          model: used,
          output_text: outputText(data),
          sources
        };
      }

      if (res.status === 429) {
        const errorText = await res.text();

        return {
          ok: false,
          status: 429,
          error: errorText,
          quota_exceeded: true
        };
      }

      if (res.status >= 500) {
        const errorText = await res.text();

        console.log(
          `Gemini attempt ${attempt} failed: HTTP ${res.status}`
        );
        console.log(errorText);

        if (attempt < 3) {
          await sleep(attempt * 1000);
          continue;
        }

        return {
          ok: false,
          status: res.status,
          error: errorText
        };
      }

      return {
        ok: false,
        status: res.status,
        error: await res.text()
      };
    } catch (error) {
      if (attempt === 3) {
        return {
          ok: false,
          error: error.message
        };
      }

      await sleep(attempt * 1000);
    }
  }

  return {
    ok: false,
    error: 'Exceeded retry attempts'
  };
}