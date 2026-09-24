const mongoose = require('mongoose');
const env = require('./env');

let isConnecting = false;

async function connectDB() {
  if (isConnecting) return;
  isConnecting = true;

  mongoose.set('strictQuery', true);

  const connectWithRetry = async (retriesLeft = 2) => {
    try {
      const opts = {
        autoIndex: env.nodeEnv !== 'production', // Indexes must be created via migration in production
        serverSelectionTimeoutMS: 5000,
      };
      // Only allow invalid TLS certs in non-production environments
      if (env.nodeEnv !== 'production') opts.tlsAllowInvalidCertificates = true;

      await mongoose.connect(env.mongoUri, opts);
      // eslint-disable-next-line no-console
      console.log(`[db] MongoDB connected → ${mongoose.connection.host}/${mongoose.connection.name}`);
    } catch (err) {
      console.error(`[db] Connection failed to ${env.mongoUri}: ${err.message}`);
      if (env.nodeEnv !== 'production') {
        try {
          console.log('[db] Primary connection failed. Trying local MongoDB fallback (mongodb://127.0.0.1:27017/laetus_erp)…');
          await mongoose.connect('mongodb://127.0.0.1:27017/laetus_erp', { serverSelectionTimeoutMS: 3000 });
          console.log('[db] Local MongoDB connected → mongodb://127.0.0.1:27017/laetus_erp');
          return;
        } catch (localErr) {
          console.warn('[db] Local MongoDB fallback failed:', localErr.message);
        }
        try {
          console.log('[db] Starting in-memory MongoDB fallback for local development…');
          const { MongoMemoryServer } = require('mongodb-memory-server');
          const mongod = await MongoMemoryServer.create();
          const uri = mongod.getUri();
          await mongoose.connect(uri);
          console.log(`[db] In-memory MongoDB connected → ${uri}`);
          return;
        } catch (memErr) {
          console.error('[db] In-memory fallback failed:', memErr.message);
        }
      }
      if (retriesLeft > 0) {
        console.log(`[db] Retrying in 2s… (${retriesLeft} attempts left)`);
        await new Promise((r) => setTimeout(r, 2000));
        return connectWithRetry(retriesLeft - 1);
      }
      throw err;
    }
  };

  await connectWithRetry();

  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));
  mongoose.connection.on('error', (err) => console.error(`[db] MongoDB error: ${err.message}`));
}

module.exports = connectDB;
