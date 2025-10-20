import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { body, validationResult } from 'express-validator';

// --------------------
// MongoDB Connection
// --------------------
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.warn('⚠️ MONGODB_URI not set.');
}

let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection) return cachedConnection;

  cachedConnection = await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  return cachedConnection;
}

// --------------------
// Mongoose Schema
// --------------------
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  message: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
});

const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);

// --------------------
// Nodemailer Transport
// --------------------
async function createTransporter() {
  if (process.env.NODE_ENV === 'production') {
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
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
}

// --------------------
// Serverless Handler
// --------------------
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Parse JSON body
  const { name, email, message } = req.body;

  // Basic validation
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Name must be at least 2 characters' });
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address' });
  }
  if (!message || message.trim().length < 10) {
    return res.status(400).json({ success: false, error: 'Message must be at least 10 characters' });
  }

  try {
    await connectToDatabase();

    // Save contact message
    const contactMessage = new Contact({ name, email, message });
    await contactMessage.save();

    const transporter = await createTransporter();

    // Admin email
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@portfolio.com',
      to: 'chalabirmechu@gmail.com',
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });

    // Auto reply
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@portfolio.com',
      to: email,
      subject: 'Thank you for contacting Chala Birmechu',
      html: `
        <h2>Thank you for your message!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for reaching out! I have received your message and will respond as soon as possible.</p>
        <p>Best regards,<br>Chala Birmechu</p>
      `,
    });

    return res.status(200).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({ success: false, error: 'Failed to send message' });
  }
}
