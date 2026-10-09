import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

const UniversitySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    city: String,
    region: String,
    type: String,
    description: String,
    website: String,
    departments: [String],
    tags: [String],
    officialSources: [String],
    aliases: [String]
  },
  { timestamps: true }
);

const PathwaySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: String,
    fields: [String],
    skills: [String],
    subjects: [String],
    careers: [String],
    universitySlugs: [String],
    stages: [
      {
        title: String,
        description: String,
        resourceIds: [String]
      }
    ]
  },
  { timestamps: true }
);

/*
 * Verified relationship between a university and an academic program.
 *
 * This is intentionally separate from Pathway.universitySlugs because
 * a pathway/university relationship needs evidence and program-level
 * information.
 */
const UniversityProgramSchema = new Schema(
  {
    university_slug: {
      type: String,
      required: true,
      index: true
    },
    pathway_slug: {
      type: String,
      required: true,
      index: true
    },
    program_name: {
      type: String,
      required: true
    },
    degree: {
      type: String,
      required: true
    },
    level: {
      type: String,
      enum: [
        'undergraduate',
        'graduate',
        'postgraduate',
        'certificate',
        'other'
      ],
      required: true,
      index: true
    },
    campus: String,
    status: {
      type: String,
      enum: ['active', 'inactive', 'unknown'],
      default: 'unknown',
      index: true
    },
    accreditation: {
      status: {
        type: String,
        enum: ['accredited', 'not_accredited', 'unknown'],
        default: 'unknown'
      },
      authority: String,
      reference: String,
      valid_until: Date
    },
    source_url: {
      type: String,
      required: true
    },
    source_type: {
      type: String,
      enum: [
        'university',
        'eta',
        'government',
        'legislation',
        'published_paper',
        'other'
      ],
      required: true
    },
    evidence: String,
    verified_at: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

UniversityProgramSchema.index(
  {
    university_slug: 1,
    pathway_slug: 1,
    level: 1
  },
  {
    unique: true
  }
);

const ResourceSchema = new Schema(
  {
    external_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: [
        'video',
        'course',
        'article',
        'paper',
        'document',
        'website',
        'project',
        'discussion'
      ],
      required: true
    },
    provider: String,
    url: String,
    embed_url: String,
    thumbnail_url: String,
    author: String,
    description: String,
    university_slug: String,
    pathway_slug: String,
    topics: [String],
    source_kind: String,
    published_at: Date,
    searchable: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const KnowledgeChunkSchema = new Schema(
  {
    chunk_id: { type: String, required: true, unique: true, index: true },
    source_url: { type: String, required: true, index: true },
    source_title: { type: String, required: true },
    source_type: { type: String, default: 'other', index: true },
    text: { type: String, required: true },
    chunk_index: { type: Number, required: true },
    language: { type: String, default: 'en' },
    embedding_model: { type: String, required: true },
    embedding: { type: [Number], required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ingested_at: { type: Date, default: Date.now }
  },
  { timestamps: true }
);
KnowledgeChunkSchema.index({ source_url: 1, chunk_index: 1 }, { unique: true });

const InteractionEventSchema = new Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true
    },
    entity_type: String,
    entity_id: String,
    metadata: Schema.Types.Mixed,
    created_at: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

const UserIntelligenceSchema = new Schema(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    signals: {
      type: [Schema.Types.Mixed],
      default: []
    },
    explored_universities: {
      type: [String],
      default: []
    },
    explored_pathways: {
      type: [String],
      default: []
    },
    saved_resources: {
      type: [String],
      default: []
    },
    rejected_resources: {
      type: [String],
      default: []
    },
    summary: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

const RecommendationSchema = new Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true
    },
    entity_type: {
      type: String,
      required: true
    },
    entity_id: {
      type: String,
      required: true
    },
    reason: String,
    confidence: Number,
    status: {
      type: String,
      default: 'active'
    },
    source: String
  },
  { timestamps: true }
);

RecommendationSchema.index({
  user_id: 1,
  status: 1
});

export const University =
  models.University || model('University', UniversitySchema);

export const Pathway =
  models.Pathway || model('Pathway', PathwaySchema);

export const UniversityProgram =
  models.UniversityProgram ||
  model('UniversityProgram', UniversityProgramSchema);

export const Resource =
  models.Resource || model('Resource', ResourceSchema);

export const KnowledgeChunk =
  models.KnowledgeChunk || model('KnowledgeChunk', KnowledgeChunkSchema);

export const InteractionEvent =
  models.InteractionEvent ||
  model('InteractionEvent', InteractionEventSchema);

export const UserIntelligence =
  models.UserIntelligence ||
  model('UserIntelligence', UserIntelligenceSchema);

export const Recommendation =
  models.Recommendation ||
  model('Recommendation', RecommendationSchema);