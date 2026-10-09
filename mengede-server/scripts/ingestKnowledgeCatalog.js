import 'dotenv/config';
import mongoose from 'mongoose';
import { connectMongo } from '../lib/mongo.js';
import { UNIVERSITY_PROGRAM_CATALOG } from '../data/universityProgramCatalog.js';
import { UNIVERSITY_CATALOG } from '../data/universityCatalog.js';
import { ingestKnowledgeDocument } from '../services/rag.js';

const universities = new Map(UNIVERSITY_CATALOG.map(item => [item.slug, item]));

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Set GEMINI_API_KEY in mengede-server/.env before indexing the catalog.');
  }
  await connectMongo();

  let indexed = 0;
  for (const program of UNIVERSITY_PROGRAM_CATALOG) {
    const university = universities.get(program.university_slug);
    if (!university) {
      console.warn(`Skipping program with unknown university: ${program.university_slug}`);
      continue;
    }

    const title = `Undergraduate program: ${program.program_name} at ${university.name}`;
    const text = [
      `University: ${university.name}.`,
      `Program name: ${program.program_name}.`,
      `Degree: ${program.degree}.`,
      `Level: ${program.level}.`,
      `Catalog status: ${program.status || 'unknown'}.`,
      `Pathway slug: ${program.pathway_slug}.`,
      `Evidence recorded in Mengede's structured program catalog: ${program.evidence || 'No evidence note supplied.'}`,
      'This chunk represents the current catalog record, not an independent accreditation determination.',
    ].join('\n');

    await ingestKnowledgeDocument({
      title,
      sourceUrl: program.source_url,
      sourceType: 'university',
      text,
      language: 'en',
      metadata: {
        university_slug: program.university_slug,
        pathway_slug: program.pathway_slug,
        degree: program.degree,
        level: program.level,
        catalog_status: program.status || 'unknown',
        source_type: program.source_type
      }
    });
    indexed += 1;
    console.log(`Indexed ${indexed}/${UNIVERSITY_PROGRAM_CATALOG.length}: ${title}`);
  }

  console.log(`RAG catalog indexing complete: ${indexed} program records indexed.`);
}

main()
  .catch(error => {
    console.error('RAG catalog indexing failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
