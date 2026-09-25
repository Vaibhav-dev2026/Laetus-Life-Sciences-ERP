function sanitizeMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return '<empty-uri>';
  try {
    return uri.replace(/\/\/(.*?):(.*?)@/, '//<user>:***@');
  } catch {
    return '<redacted-uri>';
  }
}

function validateMongoUri(uri, nodeEnv) {
  if (!uri || typeof uri !== 'string') {
    return { valid: false, reason: 'MONGO_URI environment variable is missing or empty.' };
  }
  const trimmed = uri.trim();
  if (!trimmed.startsWith('mongodb://') && !trimmed.startsWith('mongodb+srv://')) {
    return { valid: false, reason: 'MONGO_URI must start with "mongodb://" or "mongodb+srv://".' };
  }

  const mainPart = trimmed.split('://')[1] || '';
  const pathIndex = mainPart.indexOf('/');
  const hostAndAuth = pathIndex !== -1 ? mainPart.substring(0, pathIndex) : mainPart;

  const atCount = (hostAndAuth.match(/@/g) || []).length;
  if (atCount > 1) {
    return {
      valid: false,
      reason: 'MONGO_URI appears malformed. Multiple "@" characters detected in connection credentials. Verify that reserved characters (such as "@", ":", "/", "#", "?") in database username or password are URL-encoded (e.g. "@" as "%40", ":" as "%3A", "/" as "%2F").',
    };
  }

  if (nodeEnv === 'production') {
    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
      return { valid: false, reason: 'Production MONGO_URI cannot point to localhost or 127.0.0.1.' };
    }
  }

  return { valid: true };
}

function loadEnv() {
  require('dotenv').config();

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  const missing = [];

  if (!mongoUri && process.env.NODE_ENV !== 'test') missing.push('MONGO_URI');
  if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'test') missing.push('JWT_SECRET');

  if (missing.length) {
    // Fail fast: the server should never start accepting traffic without these.
    // eslint-disable-next-line no-console
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    // eslint-disable-next-line no-console
    console.error('Copy .env.example to .env and fill in the values before starting the server.');
    process.exit(1);
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 5000,
    mongoUri,
    sanitizedMongoUri: sanitizeMongoUri(mongoUri),
    sanitizeMongoUri,
    validateMongoUri,
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
