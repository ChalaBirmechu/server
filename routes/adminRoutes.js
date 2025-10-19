const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Contact = require('../models/Contact');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// Admin login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let admin = await Admin.findOne({ email });
    if (!admin) {
      console.log('Creating default admin...');
      const hashedPassword = await bcrypt.hash(process.env.SESSION_SECRET, 12);
      admin = await Admin.create({
        email: process.env.EMAIL_USER,
        password: hashedPassword,
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: admin._id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ success: true, token });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get messages (protected)
router.get('/messages', auth, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Mark as read
router.patch('/messages/:id/read', auth, async (req, res) => {
  try {
    const msg = await Contact.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true, message: 'Message marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update message' });
  }
});

module.exports = router;
