// routes/marks.js

const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/requireAuth");

const router = express.Router();

const SUBJECT_KEYS = ["maths", "physics", "chemistry", "biology", "social", "kannada", "english"];

// GET /api/marks/tests — anyone logged in (students need this to see their own marks)
router.get("/tests", requireAuth, (req, res) => {
  const tests = db.prepare("SELECT id, name, date FROM tests ORDER BY date").all();
  res.json(tests);
});

// POST /api/marks/tests — admin only, create a new test
const newTestSchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post("/tests", requireAuth, requireAdmin, (req, res) => {
  const parsed = newTestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const row = db.prepare("SELECT id FROM tests ORDER BY id DESC LIMIT 1").get();
  const num = row ? parseInt(row.id.slice(1), 10) + 1 : 1;
  const id = "T" + num;

  db.prepare("INSERT INTO tests (id, name, date) VALUES (?, ?, ?)").run(id, parsed.data.name, parsed.data.date);
  res.status(201).json({ id, name: parsed.data.name, date: parsed.data.date });
});

// GET /api/marks/:testId — anyone logged in; students get filtered to their
// own marks below at the route level via query, admin gets everything for
// the class they're viewing (filtering by class happens client-side same
// as the current UI, to keep this endpoint simple).
router.get("/:testId", requireAuth, (req, res) => {
  const { testId } = req.params;

  if (req.user.role === "student") {
    const rows = db.prepare(
      "SELECT subject, score FROM marks WHERE test_id = ? AND student_id = ?"
    ).all(testId, req.user.studentId);
    const subjects = {};
    rows.forEach(r => { subjects[r.subject] = r.score; });
    return res.json({ [req.user.studentId]: subjects });
  }

  // admin: full breakdown for this test, grouped by student
  const rows = db.prepare("SELECT student_id, subject, score FROM marks WHERE test_id = ?").all(testId);
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.student_id]) grouped[row.student_id] = {};
    grouped[row.student_id][row.subject] = row.score;
  }
  res.json(grouped);
});

// POST /api/marks/:testId — admin only, set one student's score for one subject
const setMarkSchema = z.object({
  studentId: z.string().min(1),
  subject: z.enum(SUBJECT_KEYS),
  score: z.number().int().min(0).max(100),
});

router.post("/:testId", requireAuth, requireAdmin, (req, res) => {
  const parsed = setMarkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { testId } = req.params;
  const { studentId, subject, score } = parsed.data;

  const test = db.prepare("SELECT id FROM tests WHERE id = ?").get(testId);
  if (!test) return res.status(404).json({ error: "Test not found" });

  db.prepare(`
    INSERT INTO marks (test_id, student_id, subject, score)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (test_id, student_id, subject) DO UPDATE SET score = excluded.score
  `).run(testId, studentId, subject, score);

  res.json({ message: "Mark recorded" });
});

module.exports = router;
