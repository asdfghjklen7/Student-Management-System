require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));   // room for the small profile photo

// REST API
app.use('/api/auth',     require('./routes/authRoutes'));
app.use('/api/users',    require('./routes/userRoutes'));      // admin: account registrations
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/courses',  require('./routes/courseRoutes'));
app.use('/api/grades',   require('./routes/gradeRoutes'));
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Front-end
app.use(express.static(path.join(__dirname, 'public')));

// Malformed JSON etc.
app.use((err, req, res, next) => res.status(err.status || 500).json({ message: err.message || 'Server error' }));

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
  .catch(err => { console.error('DB connection failed:', err.message); process.exit(1); });
