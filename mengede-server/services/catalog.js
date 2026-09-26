import {
  University,
  Pathway,
  Resource,
} from '../models/intelligence.js';
import {
  UNIVERSITY_CATALOG,
  PATHWAY_CATALOG,
  RESOURCE_CATALOG,
} from '../data/universityCatalog.js';

let seeded = false;
let seedPromise = null;

async function seedCatalog() {
  await Promise.all([
    ...UNIVERSITY_CATALOG.map(item =>
      University.updateOne(
        { slug: item.slug },
        { $set: item },
        { upsert: true }
      )
    ),
    ...PATHWAY_CATALOG.map(item =>
      Pathway.updateOne(
        { slug: item.slug },
        { $set: item },
        { upsert: true }
      )
    ),
    ...RESOURCE_CATALOG.map(item =>
      Resource.updateOne(
        { external_id: item.external_id },
        { $set: item },
        { upsert: true }
      )
    ),
  ]);

  seeded = true;
}

export async function ensureCatalog() {
  if (seeded) return;

  if (!seedPromise) {
    seedPromise = seedCatalog().catch(error => {
      seedPromise = null;
      throw error;
    });
  }

  await seedPromise;
}

export async function listUniversities() {
  await ensureCatalog();
  return University.find({}).sort({ name: 1 }).lean();
}

export async function getUniversity(slug) {
  await ensureCatalog();
  return University.findOne({ slug }).lean();
}

export async function listPathways() {
  await ensureCatalog();
  return Pathway.find({}).sort({ name: 1 }).lean();
}

export async function getPathway(slug) {
  await ensureCatalog();
  return Pathway.findOne({ slug }).lean();
}

export async function listResources({
  universitySlug,
  pathwaySlug,
  type,
} = {}) {
  await ensureCatalog();

  const query = {};

  if (universitySlug) query.university_slug = universitySlug;
  if (pathwaySlug) query.pathway_slug = pathwaySlug;
  if (type) query.type = type;

  return Resource.find(query).sort({ createdAt: -1 }).lean();
}
