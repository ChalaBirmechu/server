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
const allowedOrigins = [
  process.env.FRONTEND_URL, // e.g. https://chalabirmechngs.vercel.app
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS not allowed for this origin'));
    },
    credentials: true,
  })
);

// --- Body parsing middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- MongoDB connection ---
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.warn('⚠️ MONGODB_URI not set. Please configure it in your .env file.');
}

mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
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
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set for production mailer.');
    }
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
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

// Portfolio data
app.get('/api/portfolio', async (req, res) => {
  try {
    const portfolioData = {
      personalInfo: {
        name: 'Chala Birmechu',
        title: 'Full Stack & Mobile Developer',
        location: 'Addis Ababa, Ethiopia',
        email: 'chalabirmechu@gmail.com',
        phone: ['+251915950217', '+251941274261'],
        bio: 'I am a passionate software engineer specializing in full-stack web development and mobile application development. With hands-on experience in both frontend & backend technologies as well as native and cross-platform mobile apps, I bring ideas to life through clean code and scalable architecture.',
        experience: '2+',
        projects: '5+',
        clients: '3+',
        satisfaction: '100%',
      },
      skills: {
        frontend: ['React', 'Vue', 'HTML5', 'CSS3', 'JavaScript', 'TailwindCSS'],
        backend: ['Node.js', 'Express', 'Django', 'Spring Boot', 'Flask'],
        mobile: ['Flutter', 'React Native', 'Android', 'iOS'],
        devops: ['Git', 'Docker', 'AWS', 'Heroku', 'CI/CD'],
      },
    };
    res.json(portfolioData);
  } catch (error) {
    console.error('Error fetching portfolio data:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio data' });
  }
});

// Contact form submission
app.post(
  '/api/contact',
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('message')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Message must be between 10 and 1000 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { name, email, message } = req.body;
      const contactMessage = new Contact({ name, email, message });
      await contactMessage.save();

      const transporter = await createTransporter();

      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@portfolio.com',
        to: 'chalabirmechu@gmail.com',
        subject: `New Contact Form Submission from ${name}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <hr>
          <p><em>Sent from portfolio contact form</em></p>
        `,
      };

      const autoReply = {
        from: process.env.EMAIL_USER || 'noreply@portfolio.com',
        to: email,
        subject: 'Thank you for contacting Chala Birmechu',
        html: `
          <h2>Thank you for your message!</h2>
          <p>Hi ${name},</p>
          <p>Thank you for reaching out! I've received your message and will get back to you as soon as possible.</p>
          <p>Best regards,<br>Chala Birmechu</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      await transporter.sendMail(autoReply);

      res.json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({
        error: 'Failed to send message. Please try again later.',
      });
    }
  }
);

// Admin: get messages
app.get('/api/admin/messages', async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 }).limit(50);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Mark as read
app.patch('/api/admin/messages/:id/read', async (req, res) => {
  try {
    const message = await Contact.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// --- Root route ---
app.get('/', (req, res) => {
  res.send('🌍 Portfolio Backend API is Running. Use /api endpoints.');
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Internal server error',
  });
});

// --- 404 fallback ---
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested endpoint does not exist',
  });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 Portfolio server running on port ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
