require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Student = require('./models/Student');
const Course = require('./models/Course');
const Grade = require('./models/Grade');
const User = require('./models/User');
const Enrollment = require('./models/Enrollment');
const { hashPassword } = require('./utils/security');

const DEMO_PASSWORD = 'password123';
const DF = 'Bachelor of Science in Computer Science with specialization in Digital Forensics (BSCS-DF)';
const ML = 'Bachelor of Science in Computer Science with specialization in Machine Learning';
const DEPT = 'College of Computing and Information Technologies';

const students = [
  { name: 'Cruz, Elizha Gonzaga', studentNum: '2024-1005793', program: DF, year: '3rd Year', email: 'cruzeg@students.national-u.edu.ph', mobile: '(+63) 967 121 1798', birthDate: '2005-10-06' },
  { name: 'Casa, Aron', studentNum: '2023-101123', program: DF, year: '3rd Year', email: 'casa.aron@students.national-u.edu.ph' },
  { name: 'Dela Cruz, Fleincy', studentNum: '2023-102341', program: ML, year: '3rd Year', email: 'delacruz.f@students.national-u.edu.ph' },
  { name: 'Pasion, Ella', studentNum: '2023-104521', program: DF, year: '3rd Year', email: 'pasion.e@students.national-u.edu.ph' }
];

const professors = [
  { name: 'Mr. Gaudencio Jeffrey G. Romano', email: 'romano.g@national-u.edu.ph', employeeId: 'FAC-0001' },
  { name: 'Mr. Eliseo Q. Ramirez', email: 'ramirez.e@national-u.edu.ph', employeeId: 'FAC-0002' },
  { name: 'Mrs. Susan S. Caluya', email: 'caluya.s@national-u.edu.ph', employeeId: 'FAC-0003' },
  { name: 'Mr. Florencio V. Contreras Jr.', email: 'contreras.f@national-u.edu.ph', employeeId: 'FAC-0004' },
  { name: 'Dr. John Marshall', email: 'marshall.j@national-u.edu.ph', employeeId: 'FAC-0005' }
];

// [code, title, units, professor email, schedule]
const courses = [
  ['CCDIGFOL', 'INTRODUCTION TO DIGITAL FORENSICS', 3, 'romano.g@national-u.edu.ph', 'TTH 10:00 AM - 11:30 AM'],
  ['CCSFEN2L', 'SOFTWARE ENGINEERING 2', 3, 'ramirez.e@national-u.edu.ph', 'MWF 9:00 AM - 10:30 AM'],
  ['CTAPDEVL', 'APPLICATIONS DEVELOPMENT AND EMERGING TECHNOLOGIES', 3, 'caluya.s@national-u.edu.ph', 'MWF 2:00 PM - 3:30 PM'],
  ['CTINASSL', 'INFORMATION ASSURANCE AND SECURITY', 3, 'contreras.f@national-u.edu.ph', 'TTH 1:00 PM - 3:00 PM'],
  ['GEENT01X', 'THE ENTREPRENEURIAL MIND', 3, 'marshall.j@national-u.edu.ph', 'SAB 8:00 AM - 11:00 AM']
];

const cruz = (code, course, midterm, final) => ({ studentNum: '2024-1005793', studentName: 'Cruz, Elizha Gonzaga', code, course, midterm, final });
const grades = [
  cruz('CCDIGFOL', 'INTRODUCTION TO DIGITAL FORENSICS', '96 (4.0)', '98 (4.0)'),
  cruz('CCSFEN2L', 'SOFTWARE ENGINEERING 2', '88 (3.0)', '90 (3.5)'),
  cruz('CTAPDEVL', 'APPLICATIONS DEVELOPMENT AND EMERGING TECHNOLOGIES', '84 (3.0)', '86 (3.0)'),
  cruz('CTINASSL', 'INFORMATION ASSURANCE AND SECURITY', '92 (3.5)', '94 (3.5)'),
  cruz('GEENT01X', 'THE ENTREPRENEURIAL MIND', '90 (3.5)', '92 (3.5)'),
  { studentNum: '2023-101123', studentName: 'Casa, Aron', code: 'CCDIGFOL', course: 'INTRODUCTION TO DIGITAL FORENSICS', midterm: '85 (3.0)', final: '88 (3.0)' }
];

(async () => {
  await connectDB();
  await Promise.all([User.deleteMany(), Student.deleteMany(), Course.deleteMany(), Grade.deleteMany(), Enrollment.deleteMany()]);

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@national-u.edu.ph').toLowerCase();
  await User.create({
    role: 'admin', status: 'approved', name: 'System Administrator', email: adminEmail,
    passwordHash: hashPassword(process.env.ADMIN_PASSWORD || DEMO_PASSWORD)
  });

  const profDocs = await User.insertMany(professors.map(p => ({
    ...p, role: 'professor', status: 'approved', department: DEPT, approvedAt: new Date(), passwordHash: hashPassword(DEMO_PASSWORD)
  })));
  const profByEmail = Object.fromEntries(profDocs.map(p => [p.email, p._id]));

  await Student.insertMany(students.map(({ mobile, birthDate, ...s }) => s));
  await User.insertMany(students.map(s => ({
    ...s, role: 'student', status: 'approved', approvedAt: new Date(), passwordHash: hashPassword(DEMO_PASSWORD)
  })));

  await Course.insertMany(courses.map(([code, title, units, email, schedule]) => ({ code, title, units, professor: profByEmail[email], schedule })));
  await Enrollment.insertMany(students.flatMap(s => courses.map(c => ({ studentNum: s.studentNum, code: c[0] }))));
  await Grade.insertMany(grades.map(g => ({ ...g, units: 3 })));

  console.log('Seeded: 1 admin, %d professors, %d students, %d courses, %d grades', professors.length, students.length, courses.length, grades.length);
  console.log('Demo password for every seeded account: %s', process.env.ADMIN_PASSWORD || DEMO_PASSWORD);
  await mongoose.disconnect();
})();
