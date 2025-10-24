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
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { name, email, message } = req.body;

      // Save to MongoDB
      const contactMessage = new Contact({ name, email, message });
      await contactMessage.save();
      console.log('✅ Contact message saved to database');

      let transporter;
      try {
        // Create transporter
        transporter = await createTransporter();
        console.log('✅ Email transporter created');
      } catch (transporterError) {
        console.error('❌ Transporter creation failed:', transporterError);
        // Still return success since message was saved to DB
        return res.status(200).json({
          success: true,
          message: 'Message received! We saved your message but email notifications are temporarily unavailable.',
        });
      }

      try {
        // ------------------
        // Send admin email
        // ------------------
        const adminMailOptions = {
          from: process.env.EMAIL_USER || 'noreply@portfolio.com',
          to: 'chalabirmechu@gmail.com',
          subject: `New Contact Message from ${name}`,
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

        const adminMail = await transporter.sendMail(adminMailOptions);
        console.log('✅ Admin notification email sent');

        // ------------------
        // Send auto-reply
        // ------------------
        const autoReplyOptions = {
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

        const autoReply = await transporter.sendMail(autoReplyOptions);
        console.log('✅ Auto-reply email sent');

        // Preview links (for development only)
        if (process.env.NODE_ENV !== 'production') {
          console.log('📧 Admin Email Preview:', nodemailer.getTestMessageUrl(adminMail));
          console.log('📧 Auto Reply Preview:', nodemailer.getTestMessageUrl(autoReply));
        }

        return res.status(200).json({
          success: true,
          message: 'Message sent successfully!',
        });

      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError);
        
        // Still return success since message was saved to DB, but inform about email issue
        return res.status(200).json({
          success: true,
          message: 'Message received! We saved your message but there was an issue sending email notifications.',
        });
      }

    } catch (error) {
      console.error('❌ Contact form error:', error);
      
      // More specific error messages
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Database validation failed',
          message: 'Please check your input data',
        });
      }

      if (error.name === 'MongoError' || error.name === 'MongoServerError') {
        return res.status(503).json({
          success: false,
          error: 'Database temporarily unavailable',
          message: 'Please try again in a few moments',
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process your message. Please try again later.',
      });
    }
  }
);

module.exports = router;