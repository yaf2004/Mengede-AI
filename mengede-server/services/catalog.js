import {
  University,
  Pathway,
  Resource,
  UniversityProgram
} from '../models/intelligence.js';

import {
  UNIVERSITY_CATALOG,
  PATHWAY_CATALOG,
  RESOURCE_CATALOG
} from '../data/universityCatalog.js';

import {
  UNIVERSITY_PROGRAM_CATALOG
} from '../data/universityProgramCatalog.js';

let seeded = false;

const UNIVERSITY_ALIASES = {
  'aau': 'addis-ababa-university',
  'addis ababa university': 'addis-ababa-university',
  'addis ababa uni': 'addis-ababa-university',
  'aastu': 'addis-ababa-science-and-technology-university',
  'addis ababa science and technology university': 'addis-ababa-science-and-technology-university',
  'bahir dar university': 'bahir-dar-university',
  'bahir dar uni': 'bahir-dar-university',
  'bdu': 'bahir-dar-university',
  'jimma university': 'jimma-university',
  'jimma uni': 'jimma-university',
  'ju': 'jimma-university',
  'hawassa university': 'hawassa-university',
  'hawassa uni': 'hawassa-university',
  'hu': 'hawassa-university'
};

function normalizeLookup(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ');
}

function resolveUniversitySlug(value) {
  const normalized = normalizeLookup(value);
  return UNIVERSITY_ALIASES[normalized] || normalized;
}

export async function ensureCatalog() {
  if (seeded) return;

  for (const university of UNIVERSITY_CATALOG) {
    await University.updateOne(
      { slug: university.slug },
      { $setOnInsert: university },
      { upsert: true }
    );
  }

  for (const pathway of PATHWAY_CATALOG) {
    await Pathway.updateOne(
      { slug: pathway.slug },
      { $setOnInsert: pathway },
      { upsert: true }
    );
  }

  for (const program of UNIVERSITY_PROGRAM_CATALOG) {
    await UniversityProgram.updateOne(
      {
        university_slug: program.university_slug,
        pathway_slug: program.pathway_slug,
        level: program.level
      },
      { $set: program },
      { upsert: true }
    );
  }

  for (const resource of RESOURCE_CATALOG) {
    await Resource.updateOne(
      { external_id: resource.external_id },
      { $setOnInsert: resource },
      { upsert: true }
    );
  }

  seeded = true;
}

export async function listUniversities() {
  await ensureCatalog();

  return University.find({})
    .sort({ name: 1 })
    .lean();
}

export async function getUniversity(slug) {
  await ensureCatalog();

  const resolved = resolveUniversitySlug(slug);
  return University.findOne({
    $or: [
      { slug: resolved },
      { aliases: resolved },
      { aliases: normalizeLookup(slug) }
    ]
  }).lean();
}

export async function listPathways() {
  await ensureCatalog();

  return Pathway.find({})
    .sort({ name: 1 })
    .lean();
}

export async function getPathway(slug) {
  await ensureCatalog();

  return Pathway.findOne({ slug }).lean();
}

export async function listUniversityPrograms({
  universitySlug,
  pathwaySlug,
  level
} = {}) {
  await ensureCatalog();

  const query = {};

  if (universitySlug) {
    query.university_slug = resolveUniversitySlug(universitySlug);
  }

  if (pathwaySlug) {
    query.pathway_slug = pathwaySlug;
  }

  if (level) {
    query.level = level;
  }

  return UniversityProgram.find(query)
    .sort({ program_name: 1 })
    .lean();
}

export async function getUniversityProgram(
  universitySlug,
  pathwaySlug
) {
  await ensureCatalog();

  return UniversityProgram.findOne({
    university_slug: resolveUniversitySlug(universitySlug),
    pathway_slug: pathwaySlug
  }).lean();
}

export async function listResources({
  universitySlug,
  pathwaySlug,
  type
} = {}) {
  await ensureCatalog();

  const query = {};

  if (universitySlug) {
    query.university_slug = universitySlug;
  }

  if (pathwaySlug) {
    query.pathway_slug = pathwaySlug;
  }

  if (type) {
    query.type = type;
  }

  return Resource.find(query)
    .sort({ createdAt: -1 })
    .lean();
}