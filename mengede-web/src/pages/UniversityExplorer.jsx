import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  discoverResources,
  getResources,
  getUniversity,
  getPrograms,
  recordInteraction,
} from '../lib/api.js';
import ResourceCard from '../components/ResourceCard.jsx';
import { Icon } from '../lib/icons.jsx';

export default function UniversityExplorer() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [resources, setResources] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [universityResult, resourceResult, programResult] = await Promise.all([
        getUniversity(slug),
        getResources({ university: slug }),
        getPrograms({ university: slug, level: 'undergraduate' }),
      ]);

      if (cancelled) return;

      if (!universityResult.ok) {
        setError(universityResult.error || 'University not found.');
        return;
      }

      const university = universityResult.university;
      setData(university);
      if (programResult.ok) setPrograms(programResult.programs);
      recordInteraction('UNIVERSITY_EXPLORED', 'university', slug);

      let found = resourceResult.ok ? resourceResult.resources : [];

      if (!found.length) {
        const discovery = await discoverResources(
          university.name +
            ' Ethiopia campus student review tour ' +
            (university.departments || []).slice(0, 2).join(' ')
        );

        if (cancelled) return;
        found = discovery.ok ? discovery.resources : [];
      }

      if (!cancelled) {
        setResources(found);
      }
    }

    load().catch(loadError => {
      if (!cancelled) {
        setError(loadError.message || 'Could not load university exploration.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return <div className="card p-6 text-rose-600">{error}</div>;
  }

  if (!data) {
    return <div className="card p-6">Loading university exploration…</div>;
  }

  return (
    <div>
      <Link to="/" className="text-sm text-blue-600 font-semibold">
        ← Back
      </Link>

      <div className="card p-6 mt-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Icon name="graduation-cap" className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">{data.name}</h1>
            <p className="text-slate-500 mt-1">
              {data.city} · {data.region} · {data.type}
            </p>
            <p className="mt-3 text-slate-600">{data.description}</p>
          </div>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-bold mb-3">Departments to explore</h2>
        <div className="flex flex-wrap gap-2">
          {(data.departments || []).map(department => (
            <span
              key={department}
              className="pill glass"
              style={{ cursor: 'default' }}
            >
              {department}
            </span>
          ))}
        </div>
      </section>


      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold">Verified undergraduate programs</h2>
            <p className="text-sm text-slate-500">Program-level evidence, not department-name inference.</p>
          </div>
          <button
            type="button"
            className="pill glass text-xs"
            onClick={() => recordInteraction('UNIVERSITY_SAVED', 'university', slug)}
          >
            Save university
          </button>
        </div>
        {programs.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {programs.map(program => (
              <Link
                key={program._id || program.pathway_slug}
                to={'/pathways/' + program.pathway_slug}
                onClick={() => recordInteraction('PATHWAY_ACCEPTED', 'pathway', program.pathway_slug, { university: slug })}
                className="card p-4 hover:shadow-md transition-shadow"
              >
                <div className="font-bold">{program.program_name}</div>
                <div className="text-sm text-slate-500 mt-1">{program.degree} · {program.level}</div>
                <div className="text-xs text-emerald-600 mt-2">Verified source: {program.source_type}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card p-5 text-sm text-slate-500">No verified undergraduate program relationship is currently cataloged.</div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold mb-1">
          See what it is actually like
        </h2>
        <p className="text-sm text-slate-500 mb-3">
          Mengede searches for useful campus tours, student experiences and
          other public resources instead of sending you away with a generic
          link.
        </p>

        {resources.length ? (
          <div className="grid md:grid-cols-2 gap-4">
            {resources.map((resource, index) => (
              <ResourceCard
                key={
                  resource.external_id ||
                  resource._id ||
                  resource.url ||
                  index
                }
                resource={{
                  ...resource,
                  embed_url: resource.embed_url || resource.embedUrl,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="card p-5 text-sm text-slate-500">
            No public resources were found for this university yet.
          </div>
        )}
      </section>

      {data.website && (
        <a
          href={data.website}
          target="_blank"
          rel="noreferrer"
          className="inline-flex mt-6 text-sm text-blue-600 font-semibold"
        >
          Official university information →
        </a>
      )}
    </div>
  );
}
