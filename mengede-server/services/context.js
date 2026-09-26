import { StudentProfile, Message } from '../models/index.js';
import { getUserIntelligence } from './intelligence.js';
import { listPathways, listUniversities } from './catalog.js';

export async function buildUserContext(userId, conversationId) {
  const [profile, intelligence, messages, universities, pathways] =
    await Promise.all([
      StudentProfile.findOne({ user_id: userId }).lean(),
      getUserIntelligence(userId),
      conversationId
        ? Message.find({ conversation_id: conversationId })
            .sort({ created_at: -1 })
            .limit(12)
            .lean()
        : [],
      listUniversities(),
      listPathways(),
    ]);

  return {
    profile: profile || {
      stage: 'university-choice',
      interests: [],
      strengths: [],
      goal: '',
    },
    intelligence: intelligence || {
      signals: [],
      explored_universities: [],
      explored_pathways: [],
      saved_resources: [],
      rejected_resources: [],
      summary: '',
    },
    recentMessages: messages
      .reverse()
      .map(message => ({
        role: message.role,
        text: message.text,
      })),
    availableUniversities: universities.map(university => ({
      slug: university.slug,
      name: university.name,
      city: university.city,
      region: university.region,
      type: university.type,
      departments: university.departments,
      tags: university.tags,
    })),
    availablePathways: pathways.map(pathway => ({
      slug: pathway.slug,
      name: pathway.name,
      description: pathway.description,
      fields: pathway.fields,
      skills: pathway.skills,
      subjects: pathway.subjects,
      careers: pathway.careers,
      universitySlugs: pathway.universitySlugs,
    })),
  };
}
