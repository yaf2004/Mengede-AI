import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Icon } from '../lib/icons.jsx';
import { useAppState } from '../context/AppStateContext.jsx';
import { getRecommendations, getResources } from '../lib/api.js';
import UniversityCard from '../components/UniversityCard.jsx';
import PathwayCard from '../components/PathwayCard.jsx';
import ResourceCard from '../components/ResourceCard.jsx';

export default function Dashboard() {
  const { profile } = useAppState();
  const [data, setData] = useState({ universities: [], pathways: [] });
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getRecommendations(),
      getResources({ type: 'video' }),
    ])
      .then(([recommendations, resourceResult]) => {
        if (cancelled) return;

        if (!recommendations.ok) {
          setError(
            recommendations.error ||
              'Recommendations are unavailable right now.'
          );
        } else {
          setData(recommendations);
        }

        if (resourceResult.ok) {
          setResources(resourceResult.resources.slice(0, 3));
        }

        setLoading(false);
      })
      .catch(error => {
        if (cancelled) return;
        setError(error.message || 'Could not load your dashboard.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = (profile.name || 'Student').trim().split(/\s+/)[0];

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">
        Welcome back, {firstName}
      </h1>
      <p className="text-slate-500 mb-6">
        Let's turn university uncertainty into something you can actually explore.
      </p>

      <div className="card p-5 mb-7">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Icon name="sparkles" />
          </div>
          <div>
            <div className="font-bold">
              Don't just get a recommendation. Experience the options.
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Mengede can connect your interests to pathways and universities,
              then give you videos and resources to investigate them before you
              commit.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-6 text-sm text-rose-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card p-6 text-sm text-slate-500">
          Building your recommendations…
        </div>
      ) : (
        <>
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Pathways worth exploring</h2>
              <Link
                to="/assistant"
                className="text-sm text-blue-600 font-semibold"
              >
                Ask Mengede →
              </Link>
            </div>

            {data.pathways.length ? (
              <div className="grid md:grid-cols-2 gap-4">
                {data.pathways.map(pathway => (
                  <PathwayCard
                    key={pathway.slug}
                    pathway={pathway}
                    reason={
                      pathway.matchScore
                        ? 'Matches signals currently associated with your profile.'
                        : 'Worth exploring before making a decision.'
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="card p-5 text-sm text-slate-500">
                No pathways are available yet.
              </div>
            )}
          </section>

          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">
                Universities to investigate
              </h2>
              <Link
                to="/assistant"
                className="text-sm text-blue-600 font-semibold"
              >
                Ask why →
              </Link>
            </div>

            {data.universities.length ? (
              <div className="grid md:grid-cols-2 gap-4">
                {data.universities.map(university => (
                  <UniversityCard
                    key={university.slug}
                    university={university}
                    reason={university.reason}
                  />
                ))}
              </div>
            ) : (
              <div className="card p-5 text-sm text-slate-500">
                No university recommendations are available yet.
              </div>
            )}
          </section>

          {resources.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-3">
                Watch before you decide
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
        </>
      )}
    </div>
  );
}
