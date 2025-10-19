const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing or invalid' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    console.error('JWT Error:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;
