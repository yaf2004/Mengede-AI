import { interact } from '../lib/gemini.js';
import { searchYouTube } from './search.js';

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
    return searchYouTube(query, { maxResults: 6 });
  }

  try {
    const data = JSON.parse(String(result.output_text || '{}'));

    return (data.resources || [])
      .filter(resource => resource?.url)
      .map(resource => ({
        ...resource,
        type: RESOURCE_TYPES.has(resource.type)
          ? resource.type
          : 'article',
        embedUrl:
          resource.embedUrl ||
          (resource.type === 'video' ? youtubeEmbed(resource.url) : undefined),
      }));
  } catch {
    return searchYouTube(query, { maxResults: 6 });
  }
}
