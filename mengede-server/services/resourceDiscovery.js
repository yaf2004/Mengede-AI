import { interact } from '../lib/gemini.js';
import { searchYouTube } from './search.js';
import { searchScholarXIV, isScholarXIVConfigured } from './scholarxiv.js';

const RESOURCE_TYPES = new Set([
  'video',
  'course',
  'article',
  'paper',
  'document',
  'website',
  'project',
  'discussion',
]);

const SCHEMA = {
  type: 'object',
  properties: {
    resources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          type: { type: 'string' },
          provider: { type: 'string' },
          url: { type: 'string' },
          embedUrl: { type: 'string' },
          author: { type: 'string' },
          description: { type: 'string' },
          sourceKind: { type: 'string' },
        },
        required: [
          'title',
          'type',
          'provider',
          'url',
          'description',
          'sourceKind',
        ],
      },
    },
  },
  required: ['resources'],
};

function youtubeEmbed(url) {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      !['youtube.com', 'www.youtube.com'].includes(parsed.hostname) ||
      parsed.pathname !== '/watch'
    ) {
      return undefined;
    }

    const videoId = parsed.searchParams.get('v');
    return videoId
      ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`
      : undefined;
  } catch {
    return undefined;
  }
}

export async function discoverResources(query) {
  if (!query?.trim()) return [];

  const scholarXivPromise = isScholarXIVConfigured()
    ? searchScholarXIV(query, { maxResults: 5 }).catch(() => [])
    : Promise.resolve([]);

  const prompt = [
    'Find useful current public resources for an Ethiopian student exploring a university or pathway.',
    'Prioritize YouTube videos that can be embedded, official university information, and clearly attributed public student discussions.',
    'Return only real URLs found through search.',
    'Do not invent URLs.',
    'Query:',
    query.trim(),
  ].join(' ');

  const result = await interact({
    input: prompt,
    schema: SCHEMA,
    useSearch: true,
  });

  if (!result.ok) {
    const [videos, papers] = await Promise.all([
      searchYouTube(query, { maxResults: 6 }),
      scholarXivPromise
    ]);
    return [...papers, ...videos];
  }

  try {
    const data = JSON.parse(String(result.output_text || '{}'));

    const groundedUrls = new Set((result.sources || []).map(source => source.url));

    const discovered = (data.resources || [])
      .filter(resource => resource?.url && groundedUrls.has(resource.url))
      .map(resource => ({
        ...resource,
        type: RESOURCE_TYPES.has(resource.type)
          ? resource.type
          : 'article',
        embedUrl:
          resource.embedUrl ||
          (resource.type === 'video' ? youtubeEmbed(resource.url) : undefined),
      }));

    const papers = await scholarXivPromise;
    return [...papers, ...discovered];
  } catch {
    const [videos, papers] = await Promise.all([
      searchYouTube(query, { maxResults: 6 }),
      scholarXivPromise
    ]);
    return [...papers, ...videos];
  }
}
