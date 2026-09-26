import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getPathway,
  getResources,
  getUniversities,
  recordInteraction
} from '../lib/api.js';
import ResourceCard from '../components/ResourceCard.jsx';
import UniversityCard from '../components/UniversityCard.jsx';

export default function PathwayExplorer() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [resources, setResources] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [pathwayResult, resourceResult, universityResult] =
        await Promise.all([
          getPathway(slug),
          getResources({ pathway: slug }),
          getUniversities(),
        ]);

      if (cancelled) return;

      if (!pathwayResult.ok) {
        setError(pathwayResult.error || 'Pathway not found.');
        return;
      }

      setData(pathwayResult.pathway);

      if (resourceResult.ok) {
        setResources(resourceResult.resources);
      }

      if (universityResult.ok) {
        const allowed = new Set(pathwayResult.pathway.universitySlugs || []);
        setUniversities(
          universityResult.universities.filter(university =>
            allowed.has(university.slug)
          )
        );
      }

      recordInteraction('PATHWAY_EXPLORED', 'pathway', slug);
    }

    load().catch(error => {
      if (!cancelled) {
        setError(error.message || 'Could not load this pathway.');
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
    return <div className="card p-6">Loading pathway exploration…</div>;
  }

  return (
    <div>
      <Link to="/" className="text-sm text-blue-600 font-semibold">
        ← Back
      </Link>

      <div className="card p-6 mt-4">
        <h1 className="text-2xl font-extrabold">{data.name}</h1>
        <p className="text-slate-600 mt-2">{data.description}</p>

        <div className="grid md:grid-cols-3 gap-3 mt-5">
          <Info label="Subjects" values={data.subjects} />
          <Info label="Skills" values={data.skills} />
          <Info label="Possible directions" values={data.careers} />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold mb-3">Explore before you commit</h2>
        <div className="space-y-3">
          {(data.stages || []).map((stage, index) => (
            <div className="card p-4 flex gap-4" key={stage.title}>
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                {index + 1}
              </div>
              <div>
                <h3 className="font-bold">{stage.title}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {stage.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {resources.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold mb-3">
            Resources to actually try it
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {resources.map((resource, index) => (
              <ResourceCard
                key={resource.external_id || resource._id || index}
                resource={resource}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-bold mb-3">Universities to compare</h2>
        {universities.length ? (
          <div className="grid md:grid-cols-2 gap-4">
            {universities.slice(0, 6).map(university => (
              <UniversityCard
                key={university.slug}
                university={university}
              />
            ))}
          </div>
        ) : (
          <div className="card p-5 text-sm text-slate-500">
            No universities are currently linked to this pathway.
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, values = [] }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-400 font-bold">
        {label}
      </div>
      <div className="text-sm mt-1">{values.join(', ') || 'Not specified'}</div>
    </div>
  );
}
