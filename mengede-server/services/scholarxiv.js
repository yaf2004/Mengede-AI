const API_URL = 'https://scholarxiv.com/api/v1/papers/search';

export function isScholarXIVConfigured() {
  return Boolean(process.env.SCHOLARXIV_API_KEY);
}

export async function searchScholarXIV(query, { maxResults = 5 } = {}) {
  if (!query?.trim() || !isScholarXIVConfigured()) return [];

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SCHOLARXIV_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      searchFilterString: { ti: query.trim() },
      maxResults,
      sortBy: 'submittedDate',
      sortOrder: 'descending'
    })
  });

  if (!response.ok) {
    throw new Error(`ScholarXIV search failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const papers = Array.isArray(payload?.data) ? payload.data : [];

  return papers
    .filter(paper => paper?.title && (paper?.pdfUrl || paper?.url || paper?.id))
    .map(paper => ({
      external_id: String(paper.id || paper.arxivId || paper.title),
      title: paper.title,
      type: 'paper',
      provider: 'ScholarXIV',
      url: paper.pdfUrl || paper.url || `https://www.scholarxiv.com/paper/${encodeURIComponent(String(paper.id))}`,
      author: Array.isArray(paper.authors)
        ? paper.authors.map(author => author?.name || author).filter(Boolean).join(', ')
        : String(paper.authors || ''),
      description: paper.abstract || '',
      sourceKind: 'scholarxiv',
      published_at: paper.submittedDate || paper.publishedDate || undefined,
      searchable: true
    }));
}
