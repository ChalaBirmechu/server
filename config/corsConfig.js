const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn('🚫 CORS blocked for origin:', origin);
    return callback(new Error('CORS not allowed for this origin'));
  },
  credentials: true,
};

module.exports = { corsOptions };
