import 'dotenv/config';
import mongoose from 'mongoose';

let connectPromise = null;

/**
 * Connects to MongoDB using MONGODB_URI. Safe to call multiple times — the
 * connection is cached, so every route can just `await connectMongo()` and
 * get the same underlying connection.
 */
export function connectMongo() {
  if (connectPromise) return connectPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and set it.');
  }

  mongoose.set('strictQuery', true);
  connectPromise = mongoose
    .connect(uri, { dbName: process.env.MONGODB_DB || undefined })
    .then((conn) => {
      console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    })
    .catch((err) => {
      connectPromise = null; // allow a retry on the next call instead of caching a rejected promise
      throw err;
    });

  return connectPromise;
}

export function isMongoConfigured() {
  return Boolean(process.env.MONGODB_URI);
}

export default mongoose;
