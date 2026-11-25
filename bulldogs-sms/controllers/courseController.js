const Course = require('../models/Course');
const Grade = require('../models/Grade');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { str } = require('../utils/helpers');

const serialize = (c) => {
  const o = c.toObject();
  const prof = c.professor && c.professor.name ? c.professor : null;
  return { ...o, professor: prof ? prof._id : (c.professor || null), instructor: prof ? prof.name : 'To be assigned' };
};

// READ (scoped by role)
//  admin     -> all courses
//  professor -> only courses assigned to this professor
//  student   -> only courses the student is enrolled in
exports.getAll = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'professor') filter = { professor: req.user._id };
    if (req.user.role === 'student') {
      const codes = (await Enrollment.find({ studentNum: req.user.studentNum })).map(e => e.code);
      filter = { code: { $in: codes } };
    }
    const courses = await Course.find(filter).sort({ code: 1 }).populate('professor', 'name');
    res.json(courses.map(serialize));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Validate the professor assignment (must be an approved professor account)
async function resolveProfessor(id) {
  if (!id) return { professor: null };
  const prof = await User.findOne({ _id: id, role: 'professor', status: 'approved' });
  if (!prof) return { error: 'Selected professor is not an approved professor account.' };
  return { professor: prof._id };
}

const build = async (b) => {
  const out = {};
  if (b.code !== undefined) out.code = str(b.code);
  if (b.title !== undefined) out.title = str(b.title);
  if (b.units !== undefined && b.units !== '') out.units = Number(b.units);
  if (b.schedule !== undefined && str(b.schedule)) out.schedule = str(b.schedule);
  if (b.professor !== undefined) {
    const r = await resolveProfessor(b.professor);
    if (r.error) throw new Error(r.error);
    out.professor = r.professor;
  }
  return out;
};

// CREATE (admin)
exports.create = async (req, res) => {
  try {
    const c = await Course.create(await build(req.body));
    res.status(201).json(serialize(await c.populate('professor', 'name')));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A course with that code already exists.' });
    res.status(400).json({ message: err.message });
  }
};

// UPDATE (admin) - a changed code is carried over to grades and enrollments
exports.update = async (req, res) => {
  try {
    const doc = await Course.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Course not found' });
    const oldCode = doc.code;
    Object.assign(doc, await build(req.body));
    await doc.save();
    if (doc.code !== oldCode) {
      await Promise.all([
        Grade.updateMany({ code: oldCode }, { code: doc.code }),
        Enrollment.updateMany({ code: oldCode }, { code: doc.code })
      ]);
    }
    await Grade.updateMany({ code: doc.code }, { course: doc.title, units: doc.units });
    res.json(serialize(await doc.populate('professor', 'name')));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A course with that code already exists.' });
    res.status(400).json({ message: err.message });
  }
};

// DELETE (admin) - also removes its enrollments and grades
exports.remove = async (req, res) => {
  try {
    const doc = await Course.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Course not found' });
    await Promise.all([Grade.deleteMany({ code: doc.code }), Enrollment.deleteMany({ code: doc.code })]);
    res.json({ message: 'Course deleted' });
  } catch (err) { res.status(400).json({ message: err.message }); }
};
