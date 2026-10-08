import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  discoverResources,
  getPathway,
  getResources,
  getUniversities,
  getPrograms,
  recordInteraction,
  getStudyPlans,
  createStudyPlan,
  getStudyPlanTasks,
  createStudyTask,
  updateStudyTask
} from '../lib/api.js';
import ResourceCard from '../components/ResourceCard.jsx';
import UniversityCard from '../components/UniversityCard.jsx';

export default function PathwayExplorer() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [resources, setResources] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [roadmap, setRoadmap] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [roadmapBusy, setRoadmapBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [pathwayResult, resourceResult, universityResult, programResult] =
        await Promise.all([
          getPathway(slug),
          getResources({ pathway: slug }),
          getUniversities(),
          getPrograms({ pathway: slug, level: 'undergraduate' }),
        ]);

      if (cancelled) return;

      if (!pathwayResult.ok) {
        setError(pathwayResult.error || 'Pathway not found.');
        return;
      }

      setData(pathwayResult.pathway);

      let foundResources = resourceResult.ok ? resourceResult.resources : [];

      if (!foundResources.length) {
        const discovery = await discoverResources(
          pathwayResult.pathway.name +
            ' Ethiopia university students introduction course tutorial careers ' +
            (pathwayResult.pathway.careers || []).slice(0, 3).join(' ')
        );

        if (cancelled) return;
        if (discovery.ok) foundResources = discovery.resources;
      }

      if (!cancelled) setResources(foundResources);

      const plansResult = await getStudyPlans();
      if (!cancelled && plansResult.ok && plansResult.plans?.length) {
        const matching = plansResult.plans.find(plan => String(plan.title || '').toLowerCase().includes(String(pathwayResult.pathway.name || '').toLowerCase()));
        if (matching) {
          setRoadmap(matching);
          const taskResult = await getStudyPlanTasks(matching._id);
          if (!cancelled && taskResult.ok) setTasks(taskResult.tasks || []);
        }
      }

      if (universityResult.ok && programResult.ok) {
        const allowed = new Set(
          programResult.programs.map(program => program.university_slug)
        );
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


      <section className="mt-8">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold">Your exploration roadmap</h2>
              <p className="text-sm text-slate-500 mt-1">Turn this pathway into small actions instead of making one big decision.</p>
            </div>
            {!roadmap && (
              <button
                type="button"
                className="btn-primary px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                disabled={roadmapBusy}
                onClick={async () => {
                  setRoadmapBusy(true);
                  const created = await createStudyPlan({
                    title: data.name + ' exploration roadmap',
                    weeks: data.stages?.length || 1,
                    startDate: new Date().toISOString()
                  });
                  if (created.ok) {
                    setRoadmap(created.plan);
                    const createdTasks = [];
                    for (const [index, stage] of (data.stages || []).entries()) {
                      const task = await createStudyTask(created.plan._id, {
                        weekLabel: stage.title || 'Step ' + (index + 1),
                        text: stage.description || 'Explore this step.'
                      });
                      if (task.ok) createdTasks.push(task.task);
                    }
                    setTasks(createdTasks);
                    recordInteraction('ROADMAP_CREATED', 'pathway', slug);
                  }
                  setRoadmapBusy(false);
                }}
              >{roadmapBusy ? 'Building…' : 'Build my roadmap'}</button>
            )}
          </div>
          {roadmap ? (
            <div className="space-y-2">
              {tasks.map(task => (
                <label key={task._id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(task.done)}
                    onChange={async event => {
                      const done = event.target.checked;
                      setTasks(current => current.map(item => item._id === task._id ? { ...item, done } : item));
                      await updateStudyTask(task._id, done);
                      recordInteraction(done ? 'ROADMAP_TASK_COMPLETED' : 'ROADMAP_TASK_REOPENED', 'pathway', slug, { taskId: task._id });
                    }}
                  />
                  <span className={task.done ? 'line-through text-slate-400' : ''}>
                    <strong>{task.week_label || 'Step'}</strong>
                    <span className="block text-sm text-slate-500 mt-1">{task.text}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No roadmap yet. Build one when you are ready to turn exploration into action.</div>
          )}
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
