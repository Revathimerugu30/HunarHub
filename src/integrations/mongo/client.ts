import { MongoClient, Db } from 'mongodb';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'hunarhub';
const isSrvConnection = MONGODB_URI.startsWith('mongodb+srv://');

if (!process.env.MONGODB_URI) {
  // eslint-disable-next-line no-console
  console.error('❌ MONGODB_URI environment variable not set! MongoDB connections will fail at runtime.');
  // eslint-disable-next-line no-console
  console.error('❌ Please set MONGODB_URI in your environment (e.g., Vercel Environment Variables).');
} else {
  // eslint-disable-next-line no-console
  console.log('✅ MONGODB_URI loaded from environment');
  // eslint-disable-next-line no-console
  console.log('✅ Using:', process.env.MONGODB_URI.split('@')[0] + '@***');
}

let client: MongoClient | null = null;
let db: Db | null = null;
let mongooseConnected = false;

mongoose.set('bufferCommands', false);

// Add connection event listeners for debugging
mongoose.connection.on('connecting', () => {
  // eslint-disable-next-line no-console
  console.log('📡 [MongoDB] State: CONNECTING');
});

mongoose.connection.on('connected', () => {
  // eslint-disable-next-line no-console
  console.log('✅ [MongoDB] State: CONNECTED');
});

mongoose.connection.on('disconnecting', () => {
  // eslint-disable-next-line no-console
  console.log('📡 [MongoDB] State: DISCONNECTING');
});

mongoose.connection.on('disconnected', () => {
  // eslint-disable-next-line no-console
  console.log('❌ [MongoDB] State: DISCONNECTED');
});

mongoose.connection.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('❌ [MongoDB] Connection error:', err?.message ?? err);
});

export async function getMongoDb(): Promise<Db> {
  if (db) return db;
  if (!client) {
    const clientOptions: any = {
      // Keep server selection/connect timeouts short so requests fail fast
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      maxPoolSize: 5,
      minPoolSize: 1,
    };
    if (isSrvConnection) {
      clientOptions.serverApi = {
        version: '1',
        strict: false,
        deprecationErrors: false,
      };
    }
    client = new MongoClient(MONGODB_URI, clientOptions);
  }
  try {
    if (!client.topology || !client.topology.isConnected()) {
      await client.connect();
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('MongoDB connection failed:', err?.message ?? err);
    throw err;
  }
  db = client.db(MONGODB_DB);
  return db;
}

export function isMongooseConnected(): boolean {
  return mongooseConnected && mongoose.connection.readyState === 1;
}

function buildMongooseUri(): string {
  const uriWithoutQuery = MONGODB_URI.split('?')[0];
  const hasDbPath = /\/[^/]+$/.test(uriWithoutQuery);
  return hasDbPath ? MONGODB_URI : `${MONGODB_URI.replace(/\/+$/, '')}/${MONGODB_DB}`;
}

export async function connectMongoose(): Promise<void> {
  if (mongooseConnected && mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 1) {
    mongooseConnected = true;
    return;
  }

  mongooseConnected = false;
  try {
    const dbUri = buildMongooseUri();
    const mongooseOptions: any = {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      bufferCommands: false,
      retryWrites: true,
      w: 'majority',
      directConnection: !isSrvConnection,
    };
    if (isSrvConnection) {
      mongooseOptions.family = 4;
    }
    await mongoose.connect(dbUri, mongooseOptions);
    mongooseConnected = true;
    // eslint-disable-next-line no-console
    console.log('Mongoose connected to MongoDB Atlas');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Mongoose connection failed:', err?.message ?? err);
    mongooseConnected = false;
    throw err;
  }
}

export function getMongooseConnection() {
  return mongoose;
}
