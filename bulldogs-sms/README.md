# Bulldogs University – Student Management System (Node.js / Express / MongoDB)

## Setup
1. Install Node.js and MongoDB (local or Atlas).
2. `npm install`
3. Copy `.env.example` to `.env` (set `MONGO_URI` if using Atlas, and a long random `SESSION_SECRET`).
4. `npm run seed`  – loads the admin, professors, students, courses, enrollments and grades (**this wipes existing data**).
5. `npm start`     – open http://localhost:5000

## Demo accounts (password for all: `password123`)
| Role      | Login                                   |
|-----------|-----------------------------------------|
| Admin     | admin@national-u.edu.ph                 |
| Professor | contreras.f@national-u.edu.ph (CTINASSL), romano.g@…, ramirez.e@…, caluya.s@…, marshall.j@… |
| Student   | cruzeg@students.national-u.edu.ph (also casa.aron@…, delacruz.f@…, pasion.e@…) |

## How accounts work
- Sign-in is checked against the `users` collection (passwords are salted scrypt hashes).
- Unknown / wrong details for a professor or student -> "Make an account" form -> registration is saved as **pending** -> "wait for the admin to confirm".
- Admin ▸ **Account Registrations**: Confirm / Reject / Revoke. Confirming a student also adds them to the student roster.
- After approving a professor, assign subjects in **Course Catalog** (Assigned Professor). After approving a student, enroll them via **Student Records ▸ Manage enrollment**.

## Access rules (enforced by the API, not just the UI)
- Professor: sees only subjects assigned to them, only students enrolled in those subjects, and only grades of those subjects (no GPA, no other subjects). Grades can only be encoded/edited/deleted for their own subjects.
- Student: sees only own courses and grades; on **My Profile** only the photo can be changed.
- Admin: full management.

REST API: `/api/auth`, `/api/users` (admin), `/api/students`, `/api/courses`, `/api/grades` – all require a bearer token except `/api/auth/login` and `/api/auth/register`.
