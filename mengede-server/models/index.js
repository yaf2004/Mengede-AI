import mongoose from './../lib/mongo.js';

const { Schema, model, models } = mongoose;

// Mirrors the old Drizzle tables 1:1 so nothing downstream had to change shape,
// just the storage engine. `user_id` stays a plain string (Voxide/session id),
// not a Mongo ObjectId, to match how the frontend already refers to users.

const StudentProfileSchema = new Schema(
  {
    user_id: { type: String, required: true, unique: true, index: true },
    stage: { type: String, required: true },
    grade: String,
    subjects: Schema.Types.Mixed,
    interests: Schema.Types.Mixed,
    strengths: Schema.Types.Mixed,
    goal: String,
    language: { type: String, default: 'en' },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' } }
);

const ConversationSchema = new Schema(
  {
    user_id: { type: String, required: true, index: true },
    title: String,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const MessageSchema = new Schema(
  {
    conversation_id: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    role: { type: String, required: true },
    text: { type: String, required: true },
    cards: Schema.Types.Mixed,
    sources: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const QuizResultSchema = new Schema(
  {
    user_id: { type: String, required: true, index: true },
    conversation_id: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    topic: String,
    score: Number,
    total: Number,
    missed_concepts: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const StudyPlanSchema = new Schema(
  {
    user_id: { type: String, required: true, index: true },
    title: String,
    weeks: Schema.Types.Mixed,
    start_date: Date,
    status: { type: String, default: 'active' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const PlanTaskSchema = new Schema({
  plan_id: { type: Schema.Types.ObjectId, ref: 'StudyPlan', required: true, index: true },
  user_id: { type: String, required: true, index: true },
  week_label: String,
  text: String,
  done: { type: Boolean, default: false },
  done_at: Date,
});

// Used to enforce "one booking per receipt" for the (still-mocked-in-part) booking flow.
// This used to be an in-memory Map in routes/verifyReceipt.js, which reset on every
// server restart. Persisting it here is the "real database table" the old README's
// mocked-features list said was still missing.
//
// mentor_id/slot are recorded so a student re-submitting the same paste (e.g. their browser
// tab closed between "verified" and "confirm") can be told "you already booked this with the
// same receipt" and shown their existing booking, instead of just "already used" with no path
// forward.
const UsedReceiptSchema = new Schema({
  reference_key: { type: String, required: true, unique: true, index: true }, // normalized (lowercased/trimmed) reference
  reference: { type: String, required: true },
  bank: String,
  amount: Number,
  mentor_id: String,
  slot: String,
  device_id: String,
  verified_at: { type: Date, default: Date.now },
});

// One document per booked slot. The unique index on (mentor_id, slot) is what actually
// prevents two students from booking the same time — even if two requests land at the same
// instant, only one insert can win.
const BookingSchema = new Schema({
  mentor_id: { type: String, required: true },
  slot: { type: String, required: true },
  device_id: { type: String, required: true, index: true }, // scopes "my bookings" — see lib/deviceId.js
  paid: { type: Boolean, default: false },
  bank: String,
  reference: String,
  amount: Number,
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });
BookingSchema.index({ mentor_id: 1, slot: 1 }, { unique: true });

// `models.X || model(...)` guards against OverwriteModelError when this file is
// imported more than once (e.g. by --watch reloads or tests).
export const StudentProfile = models.StudentProfile || model('StudentProfile', StudentProfileSchema);
export const Conversation = models.Conversation || model('Conversation', ConversationSchema);
export const Message = models.Message || model('Message', MessageSchema);
export const QuizResult = models.QuizResult || model('QuizResult', QuizResultSchema);
export const StudyPlan = models.StudyPlan || model('StudyPlan', StudyPlanSchema);
export const PlanTask = models.PlanTask || model('PlanTask', PlanTaskSchema);
export const UsedReceipt = models.UsedReceipt || model('UsedReceipt', UsedReceiptSchema);
export const Booking = models.Booking || model('Booking', BookingSchema);
