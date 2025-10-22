const express = require('express');
const { registerAdmin, loginAdmin } = require('../controllers/authController');

const router = express.Router();

router.post('/register', registerAdmin); // Run once to create admin, then disable or protect it
router.post('/login', loginAdmin);

module.exports = router;
