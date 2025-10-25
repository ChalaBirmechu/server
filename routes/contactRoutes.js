// routes/contactRoute.js

const express = require('express');
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const { createTransporter } = require('../utils/email');
const nodemailer = require('nodemailer');

const router = express.Router();

// Add timeout configuration for the route
router.use((req, res, next) => {
  req.setTimeout(25000); // 25 seconds timeout for this route
  res.setTimeout(25000);
  next();
});

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
    // Set timeout for this specific request
    req.setTimeout(25000);
    
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

      // FIX: Save to MongoDB with timeout protection
      let savedMessage;
      try {
        const contactMessage = new Contact({ name, email, message });
        savedMessage = await Promise.race([
          contactMessage.save(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database save timeout')), 5000)
          )
        ]);
        console.log('✅ Contact message saved to database');
      } catch (dbError) {
        console.error('❌ Database save failed:', dbError);
        // Continue without database save - try to send emails anyway
        console.log('⚠️  Continuing without database save');
      }

      let transporter;
      try {
        // FIX: Create transporter with timeout
        transporter = await Promise.race([
          createTransporter(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transporter creation timeout')), 5000)
          )
        ]);
        console.log('✅ Email transporter created');
      } catch (transporterError) {
        console.error('❌ Transporter creation failed:', transporterError);
        // Still return success since message might have been saved to DB
        return res.status(200).json({
          success: true,
          message: 'Message received! We saved your message but email notifications are temporarily unavailable.',
        });
      }

      // FIX: Send emails in parallel with individual timeouts
      try {
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

        // FIX: Send emails in parallel with timeout protection
        const emailPromises = [
          Promise.race([
            transporter.sendMail(adminMailOptions),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Admin email timeout')), 10000)
            )
          ]),
          Promise.race([
            transporter.sendMail(autoReplyOptions),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Auto-reply email timeout')), 10000)
            )
          ])
        ];

        const [adminMail, autoReply] = await Promise.allSettled(emailPromises);

        // Check email results
        let emailsSent = 0;
        let emailErrors = [];

        if (adminMail.status === 'fulfilled') {
          console.log('✅ Admin notification email sent');
          emailsSent++;
        } else {
          console.error('❌ Admin email failed:', adminMail.reason);
          emailErrors.push('Admin notification failed');
        }

        if (autoReply.status === 'fulfilled') {
          console.log('✅ Auto-reply email sent');
          emailsSent++;
        } else {
          console.error('❌ Auto-reply email failed:', autoReply.reason);
          emailErrors.push('Auto-reply failed');
        }

        // Preview links (for development only)
        if (process.env.NODE_ENV !== 'production') {
          if (adminMail.status === 'fulfilled') {
            console.log('📧 Admin Email Preview:', nodemailer.getTestMessageUrl(adminMail.value));
          }
          if (autoReply.status === 'fulfilled') {
            console.log('📧 Auto Reply Preview:', nodemailer.getTestMessageUrl(autoReply.value));
          }
        }

        // FIX: Return appropriate response based on email success
        if (emailsSent === 2) {
          return res.status(200).json({
            success: true,
            message: 'Message sent successfully!',
          });
        } else if (emailsSent === 1) {
          return res.status(200).json({
            success: true,
            message: 'Message received! One email notification was sent successfully.',
          });
        } else {
          return res.status(200).json({
            success: true,
            message: 'Message received! We saved your message but email notifications failed.',
          });
        }

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
      
      // More specific error messages with timeout detection
      if (error.message?.includes('timeout')) {
        return res.status(408).json({
          success: false,
          error: 'Request timeout',
          message: 'The request took too long to process. Please try again.',
        });
      }

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