import { MongoClient, Db } from 'mongodb';
import mongoose from 'mongoose';
import dns from 'dns';

// Use Google public DNS to improve SRV resolution in restricted network environments
dns.setServers(['8.8.8.8', '8.8.4.4']);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'hunarhub';

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
    client = new MongoClient(MONGODB_URI, {
      serverApi: {
        version: '1',
        strict: false,
        deprecationErrors: false,
      },
      // Keep server selection/connect timeouts short in dev so requests fail fast
      connectTimeoutMS: 2000,
      serverSelectionTimeoutMS: 2000,
    });
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

export async function connectMongoose(): Promise<void> {
  if (mongooseConnected && mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 1) {
    mongooseConnected = true;
    return;
  }

  mongooseConnected = false;
  try {
    const dbUri = `${MONGODB_URI}/${MONGODB_DB}`;
    await mongoose.connect(dbUri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      bufferCommands: false,
      // Enable SRV discovery with longer timeouts
      retryWrites: true,
      w: 'majority',
      // directConnection must be false for SRV to work
      directConnection: false,
      // Force IPv4 to avoid SRV DNS resolution issues in some environments
      family: 4,
    });
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
