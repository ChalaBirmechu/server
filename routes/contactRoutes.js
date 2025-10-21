// routes/contactRoute.js

const express = require('express');
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const { createTransporter } = require('../utils/email');
const nodemailer = require('nodemailer');

const router = express.Router();

router.post(
  '/',
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),
    body('message')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Message must be between 10 and 1000 characters'),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ success: false, error: 'Validation failed', details: errors.array() });
      }

      const { name, email, message } = req.body;

      // Save to MongoDB
      const contactMessage = new Contact({ name, email, message });
      await contactMessage.save();

      // Create transporter
      const transporter = await createTransporter();

      // ------------------
      // Send admin email
      // ------------------
      const adminMail = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'chalabirmechu@gmail.com',
        subject: `New Contact Message from ${name}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        `,
      });

      // ------------------
      // Send auto-reply
      // ------------------
      const autoReply = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Thank you for contacting Chala Birmechu',
        html: `
          <h2>Thank you for your message!</h2>
          <p>Hi ${name},</p>
          <p>Thank you for reaching out! I’ll get back to you as soon as possible.</p>
          <p>Best regards,<br>Chala Birmechu</p>
        `,
      });

      // Preview links (for development only)
      if (process.env.NODE_ENV !== 'production') {
        console.log('Admin Email Preview:', nodemailer.getTestMessageUrl(adminMail));
        console.log('Auto Reply Preview:', nodemailer.getTestMessageUrl(autoReply));
      }

      return res.status(200).json({
        success: true,
        message: 'Message sent successfully!',
      });
    } catch (error) {
      console.error('❌ Contact form error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send message',
      });
    }
  }
);

module.exports = router;
