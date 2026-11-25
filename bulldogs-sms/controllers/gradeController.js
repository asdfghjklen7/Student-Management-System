const Grade = require('../models/Grade');
const Course = require('../models/Course');
const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');
const { ownCourseCodes } = require('../middleware/auth');
const { str } = require('../utils/helpers');

// Can this user manage grades of this course?  admin: any course; professor: only assigned courses
const canManage = async (user, code) => {
  if (user.role === 'admin') return true;
  return (await ownCourseCodes(user)).includes(code);
};

// READ (scoped by role)
//  admin     -> all grades
//  professor -> only grades of the professor's own subjects (never other subjects)
//  student   -> only their own grades
exports.getAll = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'professor') filter = { code: { $in: await ownCourseCodes(req.user) } };
    if (req.user.role === 'student') filter = { studentNum: req.user.studentNum };
    res.json(await Grade.find(filter).sort({ code: 1, studentName: 1 }));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// CREATE (admin / professor) - one grade record per student per course
exports.create = async (req, res) => {
  try {
    const studentNum = str(req.body.studentNum), code = str(req.body.code).toUpperCase();
    const midterm = str(req.body.midterm), final = str(req.body.final);
    if (!midterm || !final) return res.status(400).json({ message: 'Midterm and final grades are required.' });

    const course = await Course.findOne({ code });
    if (!course) return res.status(404).json({ message: 'Course not found.' });
    if (!(await canManage(req.user, code))) return res.status(403).json({ message: 'This subject is not assigned to you.' });

    const student = await Student.findOne({ studentNum });
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    if (!(await Enrollment.findOne({ studentNum, code })))
      return res.status(400).json({ message: 'That student is not enrolled in this subject.' });

    if (await Grade.findOne({ studentNum, code }))
      return res.status(409).json({ message: 'A grade for this student and subject already exists. Edit it instead.' });

    const doc = await Grade.create({
      studentNum, studentName: student.name, code, course: course.title, units: course.units, midterm, final
    });
    res.status(201).json(doc);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// UPDATE (admin / professor) - only the midterm / final values can change
exports.update = async (req, res) => {
  try {
    const doc = await Grade.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Grade not found' });
    if (!(await canManage(req.user, doc.code))) return res.status(403).json({ message: 'This subject is not assigned to you.' });
    if (req.body.midterm !== undefined) doc.midterm = str(req.body.midterm);
    if (req.body.final !== undefined) doc.final = str(req.body.final);
    if (!doc.midterm || !doc.final) return res.status(400).json({ message: 'Midterm and final grades are required.' });
    await doc.save();
    res.json(doc);
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// DELETE (admin / professor)
exports.remove = async (req, res) => {
  try {
    const doc = await Grade.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Grade not found' });
    if (!(await canManage(req.user, doc.code))) return res.status(403).json({ message: 'This subject is not assigned to you.' });
    await doc.deleteOne();
    res.json({ message: 'Grade deleted' });
  } catch (err) { res.status(400).json({ message: err.message }); }
};
