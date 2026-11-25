const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema(
  {
    studentNum:  { type: String, required: true, index: true },
    studentName: { type: String, required: true },
    code:        { type: String, required: true },
    course:      { type: String, required: true },
    midterm:     { type: String, required: true },
    final:       { type: String, required: true },
    status:      { type: String, default: 'Passed' },
    units:       { type: Number, default: 3.0 }
  },
  { timestamps: true }
);

gradeSchema.index({ studentNum: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Grade', gradeSchema);
