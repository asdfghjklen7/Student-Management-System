const mongoose = require('mongoose');

// Which student takes which course (by course code)
const enrollmentSchema = new mongoose.Schema(
  {
    studentNum: { type: String, required: true, index: true },
    code:       { type: String, required: true, uppercase: true, index: true }
  },
  { timestamps: true }
);
enrollmentSchema.index({ studentNum: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
