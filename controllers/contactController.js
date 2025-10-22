const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const createTransporter = require('../config/mailer');

exports.validateContact = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('message').trim().isLength({ min: 10, max: 1000 }).withMessage('Message must be between 10 and 1000 characters'),
];

exports.submitContact = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { name, email, message } = req.body;
    const contactMessage = new Contact({ name, email, message });
    await contactMessage.save();

    const transporter = await createTransporter();

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
        <hr>
        <p><em>Sent from portfolio contact form</em></p>
      `,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@portfolio.com',
      to: email,
      subject: 'Thank you for contacting Chala Birmechu',
      html: `
        <h2>Thank you for your message!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for reaching out! I've received your message and will get back to you soon.</p>
        <p>Best regards,<br>Chala Birmechu</p>
      `,
    });

    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
};
