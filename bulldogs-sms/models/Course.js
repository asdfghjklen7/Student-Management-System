const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    code:      { type: String, required: true, unique: true, uppercase: true, trim: true },
    title:     { type: String, required: true, uppercase: true, trim: true },
    units:     { type: Number, default: 3.0 },
    // The professor (User with role "professor") this course is assigned to
    professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    schedule:  { type: String, default: 'MWF 10:00 AM - 11:30 AM' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
