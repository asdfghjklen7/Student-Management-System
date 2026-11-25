const User = require('../models/User');
const Course = require('../models/Course');
const { verifyToken } = require('../utils/security');

// Requires a valid session token AND an approved account that still exists.
exports.authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const payload = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : null);
    if (!payload) return res.status(401).json({ message: 'Please sign in again.' });
    const user = await User.findById(payload.id);
    if (!user || user.status !== 'approved') return res.status(401).json({ message: 'Please sign in again.' });
    req.user = user;
    next();
  } catch (err) { res.status(401).json({ message: 'Please sign in again.' }); }
};

exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You are not allowed to do that.' });

// Course codes assigned to the signed-in professor
exports.ownCourseCodes = async (user) =>
  (await Course.find({ professor: user._id }).select('code')).map(c => c.code);
