const mongoose = require('mongoose');

// Official student roster (created by the admin, or automatically when a student registration is approved)
const studentSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    studentNum: { type: String, required: true, unique: true, trim: true },
    program:    { type: String, required: true },
    year:       { type: String, required: true, enum: ['1st Year', '2nd Year', '3rd Year', '4th Year'] },
    email:      { type: String, trim: true, lowercase: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
