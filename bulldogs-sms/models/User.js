const mongoose = require('mongoose');

// One collection for every account: admin, professor and student.
// Professors/students start as "pending" until the admin confirms the registration.
const userSchema = new mongoose.Schema(
  {
    role:         { type: String, enum: ['admin', 'professor', 'student'], required: true, index: true },
    status:       { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    // student details
    studentNum:   { type: String, trim: true, unique: true, sparse: true },
    program:      { type: String, trim: true },
    year:         { type: String, trim: true },
    birthDate:    { type: String, trim: true },
    mobile:       { type: String, trim: true },
    photo:        { type: String },            // small JPEG data-URL, editable by the student

    // professor details
    employeeId:   { type: String, trim: true, unique: true, sparse: true },
    department:   { type: String, trim: true },

    approvedAt:   { type: Date }
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  return {
    id: this._id, role: this.role, status: this.status, name: this.name, email: this.email,
    studentNum: this.studentNum, employeeId: this.employeeId, department: this.department,
    program: this.program, year: this.year, mobile: this.mobile, birthDate: this.birthDate,
    createdAt: this.createdAt, approvedAt: this.approvedAt,
    photo: this.photo
  };
};

module.exports = mongoose.model('User', userSchema);
