const User = require('../models/User');
const Student = require('../models/Student');

// Admin: list account registrations (professors + students)
exports.list = async (req, res) => {
  try {
    const filter = { role: { $in: ['professor', 'student'] } };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.role) filter.role = req.query.role;
    const users = await User.find(filter).sort({ createdAt: -1 });
    // the photo is not needed in the registration list
    res.json(users.map(u => { const o = u.toPublic(); delete o.photo; return o; }));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Admin: confirm / reject / revoke a registration
exports.setStatus = async (req, res) => {
  try {
    const status = req.body.status;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') return res.status(404).json({ message: 'Registration not found.' });

    user.status = status;
    user.approvedAt = status === 'approved' ? new Date() : undefined;
    await user.save();

    // An approved student is added to the official roster (unless the admin already created the record)
    if (status === 'approved' && user.role === 'student') {
      const exists = await Student.findOne({ studentNum: user.studentNum });
      if (!exists) await Student.create({
        name: user.name, studentNum: user.studentNum, program: user.program, year: user.year, email: user.email
      });
    }
    res.json(user.toPublic());
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// Admin: delete a registration / account
exports.remove = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') return res.status(404).json({ message: 'Registration not found.' });
    if (user.role === 'professor') await require('../models/Course').updateMany({ professor: user._id }, { professor: null });
    await user.deleteOne();
    res.json({ message: 'Account deleted' });
  } catch (err) { res.status(400).json({ message: err.message }); }
};
