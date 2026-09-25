const mongoose = require('mongoose');
const env = require('./env');

let isConnecting = false;

async function connectDB() {
  if (isConnecting) return;
  isConnecting = true;

  mongoose.set('strictQuery', true);

  const validation = env.validateMongoUri(env.mongoUri, env.nodeEnv);
  if (!validation.valid) {
    // eslint-disable-next-line no-console
    console.error(`[db] CRITICAL MONGO_URI VALIDATION ERROR: ${validation.reason}`);
    if (env.nodeEnv === 'production') {
      // eslint-disable-next-line no-console
      console.error('[db] Terminating production startup due to malformed MONGO_URI.');
      process.exit(1);
    }
  }

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
      // eslint-disable-next-line no-console
      console.error(`[db] Connection failed to ${env.sanitizedMongoUri}: ${err.message}`);
      if (err.message.includes('ENOTFOUND') || err.message.includes('querySrv') || err.message.includes('EREFUSED')) {
        // eslint-disable-next-line no-console
        console.error('[db] Connection Error Diagnostic: If using reserved characters in database username or password (e.g. @, :, /, #, ?), ensure they are URL-encoded (e.g., "@" -> "%40", ":" -> "%3A", "/" -> "%2F"). Also verify Atlas Network Access / CIDR IP whitelisting.');
      }
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
          console.log(`[db] In-memory MongoDB connected → ${env.sanitizeMongoUri(uri)}`);
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
