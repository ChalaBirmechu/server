// --- Existing & Required Dependencies ---
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Trust proxy for Render ---
app.set('trust proxy', 1);

// --- Basic request logger ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- Security middleware ---
app.use(helmet());

// --- Rate limiter ---
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// --- CORS configuration ---
// Allow frontend domain from environment variables
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://chalabirmechngs.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow mobile apps or curl requests
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('CORS not allowed for this origin'));
    },
    credentials: true,
  })
);

// --- Body parsing middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- MongoDB connection ---
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) console.warn('⚠️ MONGODB_URI not set.');

mongoose
  .connect(mongoUri)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Contact Message Schema ---
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  message: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
});
const Contact = mongoose.model('Contact', contactSchema);

// --- Email Transporter ---
const createTransporter = async () => {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)
      throw new Error('EMAIL_USER or EMAIL_PASS not set in production.');

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // must be Gmail App Password
      },
      secure: true,
      connectionTimeout: 10000, // 10s timeout
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }
};

// --- Routes --- //

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Portfolio server is running',
    backend: 'Render',
    frontend: process.env.FRONTEND_URL,
    timestamp: new Date().toISOString(),
  });
});

// Contact form submission
app.post(
  '/api/contact',
  [
    body('name').trim().isLength({ min: 2, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('message').trim().isLength({ min: 10, max: 1000 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });

      const { name, email, message } = req.body;

      // Save message in MongoDB
      const contactMessage = new Contact({ name, email, message });
      await contactMessage.save();

      // Send email
      const transporter = await createTransporter();

      // Admin email
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@portfolio.com',
        to: 'chalabirmechu@gmail.com',
        subject: `New Contact Form Submission from ${name}`,
        html: `<h2>New Contact Form Submission</h2>
               <p><strong>Name:</strong> ${name}</p>
               <p><strong>Email:</strong> ${email}</p>
               <p><strong>Message:</strong></p>
               <p>${message.replace(/\n/g, '<br>')}</p>`,
      });

      // Auto-reply
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@portfolio.com',
        to: email,
        subject: 'Thank you for contacting Chala Birmechu',
        html: `<h2>Thank you for your message!</h2>
               <p>Hi ${name},</p>
               <p>Thank you for reaching out! I will get back to you as soon as possible.</p>
               <p>Best regards,<br>Chala Birmechu</p>`,
      });

      res.json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({
        error: 'Failed to send message. Please try again later.',
        details: error.message,
      });
    }
  }
);

// --- 404 fallback ---
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 Portfolio server running on port ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
