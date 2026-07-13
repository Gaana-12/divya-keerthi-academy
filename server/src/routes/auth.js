// routes/auth.js — account setup, login, and signup.

const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { hashPassword, verifyPassword, signToken } = require("../auth");

const router = express.Router();

/* -----------------------------------------------------------------
   POST /api/auth/setup
   One-time admin account creation. Only works if no admin exists yet —
   this is what lets us avoid ever hardcoding a password in source code.
----------------------------------------------------------------- */
const setupSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

router.post("/setup", (req, res) => {
  const parsed = setupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (existingAdmin) {
    return res.status(409).json({ error: "An admin account already exists. Setup can only be run once." });
  }

  const hash = hashPassword(parsed.data.password);
  db.prepare("INSERT INTO users (role, student_id, password_hash) VALUES ('admin', NULL, ?)").run(hash);

  res.status(201).json({ message: "Admin account created. You can now log in." });
});

router.get("/setup-status", (req, res) => {
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  res.json({ setupComplete: !!existingAdmin });
});

/* -----------------------------------------------------------------
   POST /api/auth/admin-login
----------------------------------------------------------------- */
const adminLoginSchema = z.object({
  password: z.string().min(1),
});

router.post("/admin-login", (req, res) => {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Password is required" });
  }

  const admin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
  if (!admin) {
    return res.status(404).json({ error: "No admin account exists yet. Run setup first." });
  }

  if (!verifyPassword(parsed.data.password, admin.password_hash)) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  const token = signToken({ role: "admin", userId: admin.id });
  res.json({ token, role: "admin" });
});

/* -----------------------------------------------------------------
   POST /api/auth/student-signup
   Parent/student "claims" a student record the admin already created.
   Requires the student_id PLUS the registered phone number as a
   verification step — this is what stops someone from registering
   against a record that isn't theirs just by guessing a sequential ID.
----------------------------------------------------------------- */
const signupSchema = z.object({
  studentId: z.string().min(1),
  phone: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

router.post("/student-signup", (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { studentId, phone, password } = parsed.data;

  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(studentId.trim());
  if (!student) {
    return res.status(404).json({ error: "No student found with that Student ID. Check with the academy admin." });
  }

  // Verification check: phone must match what the admin recorded at admission.
  // Trimmed and compared as-is; if you want to be lenient about formatting
  // (spaces, +91 prefixes, etc.) normalize both sides before comparing.
  if (student.phone.trim() !== phone.trim()) {
    return res.status(401).json({ error: "Phone number doesn't match our records for this Student ID." });
  }

  const existingAccount = db.prepare("SELECT id FROM users WHERE student_id = ?").get(studentId);
  if (existingAccount) {
    return res.status(409).json({ error: "An account already exists for this Student ID. Try logging in instead." });
  }

  const hash = hashPassword(password);
  db.prepare("INSERT INTO users (role, student_id, password_hash) VALUES ('student', ?, ?)").run(studentId, hash);

  const token = signToken({ role: "student", studentId });
  res.status(201).json({ token, role: "student", studentId });
});

/* -----------------------------------------------------------------
   POST /api/auth/student-login
----------------------------------------------------------------- */
const studentLoginSchema = z.object({
  studentId: z.string().min(1),
  password: z.string().min(1),
});

router.post("/student-login", (req, res) => {
  const parsed = studentLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Student ID and password are required" });
  }
  const { studentId, password } = parsed.data;

  const account = db.prepare("SELECT * FROM users WHERE role = 'student' AND student_id = ?").get(studentId.trim());
  if (!account) {
    return res.status(404).json({ error: "No account found for that Student ID. Sign up first." });
  }

  if (!verifyPassword(password, account.password_hash)) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  const token = signToken({ role: "student", studentId: account.student_id });
  res.json({ token, role: "student", studentId: account.student_id });
});

module.exports = router;
