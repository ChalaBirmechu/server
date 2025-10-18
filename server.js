// ...existing code...
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

// trust proxy for Render
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow server-to-server / curl
    return allowedOrigins.includes(origin) ? callback(null, true) : callback(new Error('CORS not allowed'));
  },
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.warn('MONGODB_URI not set. Using placeholder — set real URI in environment variables.');
}
mongoose.connect(mongoUri || 'mongodb+srv://<REPLACE_WITH_URI>', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Contact message schema
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  message: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false }
});

const Contact = mongoose.model('Contact', contactSchema);

// Email transporter configuration (fixed)
const createTransporter = async () => {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('EMAIL_USER or EMAIL_PASS not set for production mailer.');
    }
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    // development: create Ethereal test account at runtime
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Portfolio server is running',
    timestamp: new Date().toISOString()
  });
});

// Get portfolio data
// ...existing code...
app.get('/api/portfolio', async (req, res) => {
  try {
    const portfolioData = {
      // ...existing portfolio data...
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
        satisfaction: '100%'
      },
      skills: {
        frontend: ['React', 'Vue', 'HTML5', 'CSS3', 'JavaScript', 'TailwindCSS'],
        backend: ['Node.js', 'Express', 'Django', 'Spring Boot', 'Flask'],
        mobile: ['Flutter', 'React Native', 'Android', 'iOS'],
        devops: ['Git', 'Docker', 'AWS', 'Heroku', 'CI/CD']
      },
      // ...projects & experience...
    };

    res.json(portfolioData);
  } catch (error) {
    console.error('Error fetching portfolio data:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio data' });
  }
});

// Contact form submission
app.post('/api/contact', [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('message').trim().isLength({ min: 10, max: 1000 }).withMessage('Message must be between 10 and 1000 characters')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, email, message } = req.body;

    // Save to database
    const contactMessage = new Contact({ name, email, message });
    await contactMessage.save();

    // Send email notification
    let transporter;
    try {
      transporter = await createTransporter();
    } catch (tErr) {
      console.error('Failed to create mail transporter:', tErr);
    }

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
      `
    };

    const autoReplyOptions = {
      from: process.env.EMAIL_USER || 'noreply@portfolio.com',
      to: email,
      subject: 'Thank you for contacting Chala Birmechu',
      html: `
        <h2>Thank you for your message!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for reaching out! I've received your message and will get back to you as soon as possible.</p>
        <p>Best regards,<br>Chala Birmechu</p>
        <hr>
        <p><em>This is an automated response. Please do not reply to this email.</em></p>
      `
    };

    if (transporter) {
      try {
        const info1 = await transporter.sendMail(mailOptions);
        const info2 = await transporter.sendMail(autoReplyOptions);
        if (process.env.NODE_ENV !== 'production') {
          console.log('Preview URL (admin):', nodemailer.getTestMessageUrl(info1));
          console.log('Preview URL (auto-reply):', nodemailer.getTestMessageUrl(info2));
        }
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // proceed — don't fail the request if email fails
      }
    } else {
      console.warn('No mail transporter available; skipping email send.');
    }

    res.json({
      success: true,
      message: 'Message sent successfully!'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      error: 'Failed to send message. Please try again later.'
    });
  }
});

// Get contact messages (admin endpoint)
app.get('/api/admin/messages', async (req, res) => {
  try {
    const messages = await Contact.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Mark message as read
app.patch('/api/admin/messages/:id/read', async (req, res) => {
  try {
    const message = await Contact.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Portfolio server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
// ...existing code...