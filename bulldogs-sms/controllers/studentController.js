const Student = require('../models/Student');
const Course = require('../models/Course');
const Grade = require('../models/Grade');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { ownCourseCodes } = require('../middleware/auth');
const { computeGpa, str } = require('../utils/helpers');

const FIELDS = ['name', 'studentNum', 'program', 'year', 'email'];
const pick = (body) => FIELDS.reduce((o, k) => (body[k] !== undefined ? { ...o, [k]: str(body[k]) } : o), {});

// READ all (scoped by role)
//  admin     -> every student, with GPA and every enrolled course
//  professor -> ONLY students enrolled in the professor's own courses, showing ONLY those courses and NO GPA
exports.getAll = async (req, res) => {
  try {
    if (req.user.role === 'professor') {
      const codes = await ownCourseCodes(req.user);
      const enr = await Enrollment.find({ code: { $in: codes } });
      const byStudent = {};
      enr.forEach(e => (byStudent[e.studentNum] = byStudent[e.studentNum] || []).push(e.code));
      const students = await Student.find({ studentNum: { $in: Object.keys(byStudent) } }).sort({ name: 1 });
      return res.json(students.map(s => ({
        _id: s._id, name: s.name, studentNum: s.studentNum, program: s.program, year: s.year,
        email: s.email, courses: byStudent[s.studentNum].sort()
      })));
    }
    const [students, grades, enr] = await Promise.all([Student.find().sort({ name: 1 }), Grade.find(), Enrollment.find()]);
    const gBy = {}, eBy = {};
    grades.forEach(g => (gBy[g.studentNum] = gBy[g.studentNum] || []).push(g));
    enr.forEach(e => (eBy[e.studentNum] = eBy[e.studentNum] || []).push(e.code));
    res.json(students.map(s => ({
      ...s.toObject(), gpa: computeGpa(gBy[s.studentNum] || []), courses: (eBy[s.studentNum] || []).sort()
    })));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// CREATE (admin)
exports.create = async (req, res) => {
  try {
    res.status(201).json(await Student.create(pick(req.body)));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A student with that number already exists.' });
    res.status(400).json({ message: err.message });
  }
};

// UPDATE (admin) - keeps accounts, grades and enrollments in sync if the number or name changes
exports.update = async (req, res) => {
  try {
    const doc = await Student.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Student not found' });
    const oldNum = doc.studentNum;
    Object.assign(doc, pick(req.body));
    await doc.save();
    if (doc.studentNum !== oldNum) {
      await Promise.all([
        Grade.updateMany({ studentNum: oldNum }, { studentNum: doc.studentNum }),
        Enrollment.updateMany({ studentNum: oldNum }, { studentNum: doc.studentNum }),
        User.updateMany({ role: 'student', studentNum: oldNum }, { studentNum: doc.studentNum })
      ]);
    }
    await Grade.updateMany({ studentNum: doc.studentNum }, { studentName: doc.name });
    res.json(doc);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A student with that number already exists.' });
    res.status(400).json({ message: err.message });
  }
};

// DELETE (admin) - also removes the student's account, grades and enrollments
exports.remove = async (req, res) => {
  try {
    const doc = await Student.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Student not found' });
    await Promise.all([
      Grade.deleteMany({ studentNum: doc.studentNum }),
      Enrollment.deleteMany({ studentNum: doc.studentNum }),
      User.deleteMany({ role: 'student', studentNum: doc.studentNum })
    ]);
    res.json({ message: 'Student deleted' });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// SET ENROLLMENT (admin): body { codes: ['CODE1', ...] }
exports.setEnrollments = async (req, res) => {
  try {
    const doc = await Student.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Student not found' });
    const codes = [...new Set((req.body.codes || []).map(c => str(c).toUpperCase()))];
    const valid = (await Course.find({ code: { $in: codes } }).select('code')).map(c => c.code);
    const current = (await Enrollment.find({ studentNum: doc.studentNum })).map(e => e.code);

    const toAdd = valid.filter(c => !current.includes(c));
    const toDrop = current.filter(c => !valid.includes(c));
    if (toAdd.length) await Enrollment.insertMany(toAdd.map(code => ({ studentNum: doc.studentNum, code })));
    if (toDrop.length) {
      await Enrollment.deleteMany({ studentNum: doc.studentNum, code: { $in: toDrop } });
      await Grade.deleteMany({ studentNum: doc.studentNum, code: { $in: toDrop } });
    }
    res.json({ courses: valid.sort() });
  } catch (err) { res.status(400).json({ message: err.message }); }
};
