const REQUIRED = ['MONGO_URI', 'JWT_SECRET'];

function loadEnv() {
  require('dotenv').config();

  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length && process.env.NODE_ENV !== 'test') {
    // Fail fast: the server should never start accepting traffic without these.
    // eslint-disable-next-line no-console
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in the values before starting the server.');
    process.exit(1);
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGO_URI,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((s) => s.trim()),
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    backupDir: process.env.BACKUP_DIR || 'backups',
    loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
    loginRateLimitWindowMin: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MIN) || 15,
    seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'laetuslifesciences@gmail.com',
    seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || null,
  };
}

module.exports = loadEnv();
