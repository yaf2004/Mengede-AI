import {University,Pathway,Resource} from '../models/intelligence.js';
import {UNIVERSITY_CATALOG,PATHWAY_CATALOG,RESOURCE_CATALOG} from '../data/universityCatalog.js';
let seeded=false;
export async function ensureCatalog(){if(seeded)return;for(const x of UNIVERSITY_CATALOG)await University.updateOne({slug:x.slug},{$setOnInsert:x},{upsert:true});for(const x of PATHWAY_CATALOG)await Pathway.updateOne({slug:x.slug},{$setOnInsert:x},{upsert:true});for(const x of RESOURCE_CATALOG)await Resource.updateOne({external_id:x.external_id},{$setOnInsert:x},{upsert:true});seeded=true;}
export async function listUniversities(){await ensureCatalog();return University.find({}).sort({name:1}).lean();}
export async function getUniversity(slug){await ensureCatalog();return University.findOne({slug}).lean();}
export async function listPathways(){await ensureCatalog();return Pathway.find({}).sort({name:1}).lean();}
export async function getPathway(slug){await ensureCatalog();return Pathway.findOne({slug}).lean();}
export async function listResources({universitySlug,pathwaySlug,type}={}){await ensureCatalog();const q={};if(universitySlug)q.university_slug=universitySlug;if(pathwaySlug)q.pathway_slug=pathwaySlug;if(type)q.type=type;return Resource.find(q).sort({createdAt:-1}).lean();}
