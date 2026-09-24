import { pgTable, serial, text, varchar, jsonb, integer, timestamp, primaryKey, date, boolean } from 'drizzle-orm/pg-core';

export const student_profile = pgTable('student_profile', {
  user_id: varchar('user_id', { length: 64 }).primaryKey(),
  stage: varchar('stage', { length: 20 }).notNull(),
  grade: varchar('grade', { length: 32 }),
  subjects: jsonb('subjects'),
  interests: jsonb('interests'),
  strengths: jsonb('strengths'),
  goal: text('goal'),
  language: varchar('language', { length: 8 }).default('en'),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  user_id: varchar('user_id', { length: 64 }).notNull(),
  title: varchar('title', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversation_id: integer('conversation_id').notNull(),
  role: varchar('role', { length: 16 }).notNull(),
  text: text('text').notNull(),
  cards: jsonb('cards'),
  sources: jsonb('sources'),
  created_at: timestamp('created_at').defaultNow(),
});

export const quiz_results = pgTable('quiz_results', {
  id: serial('id').primaryKey(),
  user_id: varchar('user_id', { length: 64 }).notNull(),
  conversation_id: integer('conversation_id'),
  topic: varchar('topic', { length: 255 }),
  score: integer('score'),
  total: integer('total'),
  missed_concepts: jsonb('missed_concepts'),
  created_at: timestamp('created_at').defaultNow(),
});

export const study_plans = pgTable('study_plans', {
  id: serial('id').primaryKey(),
  user_id: varchar('user_id', { length: 64 }).notNull(),
  title: varchar('title', { length: 255 }),
  weeks: jsonb('weeks'),
  start_date: date('start_date'),
  status: varchar('status', { length: 16 }).default('active'),
  created_at: timestamp('created_at').defaultNow(),
});

export const plan_tasks = pgTable('plan_tasks', {
  id: serial('id').primaryKey(),
  plan_id: integer('plan_id').notNull(),
  user_id: varchar('user_id', { length: 64 }).notNull(),
  week_label: varchar('week_label', { length: 64 }),
  text: text('text'),
  done: boolean('done').default(false),
  done_at: timestamp('done_at'),
});

export const ai_usage = pgTable('ai_usage', {
  user_id: varchar('user_id', { length: 64 }).notNull(),
  day: date('day').notNull(),
  count: integer('count').default(0),
}, (t) => ({ pk: primaryKey(t.user_id, t.day) }));
