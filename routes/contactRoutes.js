const express = require('express');
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const { createTransporter } = require('../utils/email');
const nodemailer = require('nodemailer');

const router = express.Router();

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 2, max: 50 }),
    body('email').isEmail(),
    body('message').trim().isLength({ min: 10, max: 1000 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { name, email, message } = req.body;
      const contactMessage = new Contact({ name, email, message });
      await contactMessage.save();

      const transporter = await createTransporter();

      // Send admin email
      const adminMail = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'chalabirmechu@gmail.com',
        subject: `New Message from ${name}`,
        html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p>${message}</p>`,
      });

      // Send auto reply
      const autoReply = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Thank you for contacting Chala Birmechu',
        html: `<p>Hi ${name},</p><p>Thank you for your message. I'll reply soon.</p><p>— Chala Birmechu</p>`,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log('Admin Email Preview:', nodemailer.getTestMessageUrl(adminMail));
        console.log('Auto Reply Preview:', nodemailer.getTestMessageUrl(autoReply));
      }

      res.json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

module.exports = router;
