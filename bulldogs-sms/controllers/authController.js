const User = require('../models/User');
const Student = require('../models/Student');
const { hashPassword, verifyPassword, signToken } = require('../utils/security');
const { str } = require('../utils/helpers');

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Registration (students & professors only) ----------
exports.register = async (req, res) => {
  try {
    const b = req.body || {};
    const role = str(b.role);
    if (!['student', 'professor'].includes(role)) return res.status(400).json({ message: 'Only students and professors can register.' });

    const name = str(b.name), email = str(b.email).toLowerCase(), password = String(b.password || '');
    if (!name) return res.status(400).json({ message: 'Full name is required.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    const data = { role, name, email };
    const idField = role === 'student' ? 'studentNum' : 'employeeId';
    const idValue = str(b[idField]);
    if (!idValue) return res.status(400).json({ message: role === 'student' ? 'Student number is required.' : 'Employee ID is required.' });
    data[idField] = idValue;

    if (role === 'student') {
      data.program = str(b.program);
      data.year = str(b.year);
      if (!data.program) return res.status(400).json({ message: 'Program is required.' });
      if (!YEARS.includes(data.year)) return res.status(400).json({ message: 'Select a valid year level.' });
      if (str(b.mobile)) data.mobile = str(b.mobile);
      if (str(b.birthDate)) data.birthDate = str(b.birthDate);
    } else {
      data.department = str(b.department);
      if (!data.department) return res.status(400).json({ message: 'Department is required.' });
    }

    // Duplicate / re-submission handling
    const matches = await User.find({ $or: [{ email }, { [idField]: idValue }] });
    if (matches.length > 1) return res.status(409).json({ message: 'That email or ID number is already used by another registration.' });

    if (matches.length === 1) {
      const m = matches[0];
      if (m.role !== role) return res.status(409).json({ message: 'That email or ID number is already used by another account.' });
      if (m.status === 'approved') return res.status(409).json({ message: 'This account is already registered and approved. Please sign in.' });
      if (m.status === 'pending') return res.status(409).json({ message: 'This registration was already submitted and is waiting for admin confirmation.' });
      // previously rejected -> allow re-submission with the new details
      Object.assign(m, data, { passwordHash: hashPassword(password), status: 'pending' });
      await m.save();
      return res.status(201).json({ message: 'Registration re-submitted. Please wait for the admin to confirm your account.' });
    }

    await User.create({ ...data, passwordHash: hashPassword(password), status: 'pending' });
    res.status(201).json({ message: 'Registration submitted. Please wait for the admin to confirm your account.' });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'That email or ID number is already registered.' });
    res.status(400).json({ message: err.message });
  }
};

// ---------- Login: must match a registered account in the database ----------
exports.login = async (req, res) => {
  try {
    const role = str(req.body.role);
    const identifier = str(req.body.identifier);
    const password = String(req.body.password || '');
    const invalid = () => res.status(401).json({ code: 'INVALID', message: 'No registered account matches those details.' });

    if (!['admin', 'professor', 'student'].includes(role) || !identifier || !password) return invalid();

    const user = await User.findOne({
      role,
      $or: [{ email: identifier.toLowerCase() }, { studentNum: identifier }, { employeeId: identifier }]
    });
    // Password is checked before the status so nothing is revealed about accounts that are not yours.
    if (!user || !verifyPassword(password, user.passwordHash)) return invalid();

    if (user.status === 'pending')
      return res.status(403).json({ code: 'PENDING', message: 'Your registration is still waiting for the admin to confirm it. Please check back later.' });
    if (user.status === 'rejected')
      return res.status(403).json({ code: 'REJECTED', message: 'Your registration was not approved. Please contact the admin or register again with correct details.' });

    res.json({ token: signToken(user._id), user: user.toPublic() });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ---------- Current user (+ roster profile for students) ----------
exports.me = async (req, res) => {
  try {
    const user = req.user;
    const out = { user: user.toPublic() };
    if (user.role === 'student') {
      const s = await Student.findOne({ studentNum: user.studentNum });
      out.profile = {
        name: s ? s.name : user.name,
        studentNum: user.studentNum,
        program: s ? s.program : user.program,
        year: s ? s.year : user.year,
        email: user.email,
        mobile: user.mobile || '',
        birthDate: user.birthDate || '',
        department: 'COLLEGE OF COMPUTING AND INFORMATION TECHNOLOGIES'
      };
    }
    res.json(out);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ---------- Students may change ONLY their photo ----------
exports.updatePhoto = async (req, res) => {
  try {
    const photo = req.body && req.body.photo;
    if (photo === null || photo === '') {
      req.user.photo = undefined;
    } else {
      if (typeof photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))
        return res.status(400).json({ message: 'Please upload a JPG, PNG or WEBP image.' });
      if (photo.length > 400000) return res.status(400).json({ message: 'Image is too large. Please choose a smaller photo.' });
      req.user.photo = photo;
    }
    await req.user.save();
    res.json({ photo: req.user.photo || null });
  } catch (err) { res.status(400).json({ message: err.message }); }
};
