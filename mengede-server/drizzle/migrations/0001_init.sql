-- Initial schema migration for Mengede
-- Tables: student_profile, conversations, messages, quiz_results, study_plans, plan_tasks, ai_usage

CREATE TABLE IF NOT EXISTS student_profile (
  user_id varchar(64) PRIMARY KEY,
  stage varchar(20) NOT NULL,
  grade varchar(32),
  subjects jsonb,
  interests jsonb,
  strengths jsonb,
  goal text,
  language varchar(8) DEFAULT 'en',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id serial PRIMARY KEY,
  user_id varchar(64) NOT NULL,
  title varchar(255),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role varchar(16) NOT NULL,
  text text NOT NULL,
  cards jsonb,
  sources jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id serial PRIMARY KEY,
  user_id varchar(64) NOT NULL,
  conversation_id integer,
  topic varchar(255),
  score integer,
  total integer,
  missed_concepts jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_plans (
  id serial PRIMARY KEY,
  user_id varchar(64) NOT NULL,
  title varchar(255),
  weeks jsonb,
  start_date date,
  status varchar(16) DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_tasks (
  id serial PRIMARY KEY,
  plan_id integer NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  user_id varchar(64) NOT NULL,
  week_label varchar(64),
  text text,
  done boolean DEFAULT false,
  done_at timestamptz
);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id varchar(64) NOT NULL,
  day date NOT NULL,
  count integer DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_user ON study_plans(user_id);
