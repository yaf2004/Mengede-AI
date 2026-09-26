import { Icon } from '../lib/icons.jsx';
import { recordInteraction } from '../lib/api.js';

function safeEmbedUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com',
    ]);

    if (
      url.protocol !== 'https:' ||
      !allowedHosts.has(url.hostname) ||
      !url.pathname.startsWith('/embed/')
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export default function ResourceCard({ resource }) {
  const id = resource.external_id || resource._id || resource.url;
  const embedUrl =
    resource.type === 'video'
      ? safeEmbedUrl(resource.embed_url || resource.embedUrl)
      : null;

  const track = type =>
    recordInteraction(type, 'resource', id, {
      provider: resource.provider,
      title: resource.title,
    });

  return (
    <article className="card overflow-hidden">
      {embedUrl && (
        <div className="aspect-video bg-slate-900">
          <iframe
            title={resource.title}
            src={embedUrl}
            className="w-full h-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() => track('RESOURCE_VIEWED')}
          />
        </div>
      )}

      <div className="p-4">
        <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
          {resource.type} · {resource.provider || 'Mengede'}
        </div>

        <h3 className="font-bold leading-snug">{resource.title}</h3>

        {resource.author && (
          <div className="text-xs text-slate-400 mt-1">{resource.author}</div>
        )}

        {resource.description && (
          <p className="text-sm text-slate-500 mt-2">
            {resource.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => track('RESOURCE_SAVED')}
            className="pill glass text-xs"
          >
            <Icon name="save" className="w-3.5 h-3.5" /> Save
          </button>

          <button
            type="button"
            onClick={() => track('RESOURCE_COMPLETED')}
            className="pill glass text-xs"
          >
            <Icon name="check" className="w-3.5 h-3.5" /> Useful / Done
          </button>

          {resource.url && (
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => track('RESOURCE_OPENED')}
              className="pill glass text-xs"
            >
              Open source
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
