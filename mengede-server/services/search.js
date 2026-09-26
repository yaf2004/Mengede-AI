const TIMEOUT_MS = 8000;

export async function searchYouTube(query, { maxResults = 6 } = {}) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !query?.trim()) return [];

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query.trim());
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(Math.min(Math.max(maxResults, 1), 10)));
  url.searchParams.set('key', key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return [];

    const data = await response.json();

    return (data.items || [])
      .filter(item => item?.id?.videoId)
      .map(item => ({
        external_id: item.id.videoId,
        title: item.snippet.title,
        type: 'video',
        provider: 'YouTube',
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        embed_url: `https://www.youtube.com/embed/${item.id.videoId}`,
        thumbnail_url:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.medium?.url,
        author: item.snippet.channelTitle,
        description: item.snippet.description,
        published_at: item.snippet.publishedAt,
        source_kind: 'youtube-search',
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
