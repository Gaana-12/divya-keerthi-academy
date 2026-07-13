// routes/attendance.js

const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { requireAuth, requireAdmin, requireOwnRecordOrAdmin } = require("../middleware/requireAuth");

const router = express.Router();

// GET /api/attendance — admin only, full attendance map shaped like
// { "2026-06-15": { "S001": "present", "S002": "absent", ... }, ... }
// (matches the shape the frontend's demo data already used)
router.get("/", requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT date, student_id, status FROM attendance").all();
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.date]) grouped[row.date] = {};
    grouped[row.date][row.student_id] = row.status;
  }
  res.json(grouped);
});

// GET /api/attendance/:studentId — admin, or the student themself
router.get("/:studentId", requireAuth, requireOwnRecordOrAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date DESC"
  ).all(req.params.studentId);
  res.json(rows);
});

// POST /api/attendance — admin only, mark/update one student's status for a date
const markSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  studentId: z.string().min(1),
  status: z.enum(["present", "absent", "leave"]),
});

router.post("/", requireAuth, requireAdmin, (req, res) => {
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { date, studentId, status } = parsed.data;

  const student = db.prepare("SELECT id FROM students WHERE id = ?").get(studentId);
  if (!student) return res.status(404).json({ error: "Student not found" });

  db.prepare(`
    INSERT INTO attendance (student_id, date, status)
    VALUES (?, ?, ?)
    ON CONFLICT (student_id, date) DO UPDATE SET status = excluded.status, marked_at = datetime('now')
  `).run(studentId, date, status);

  res.json({ message: "Attendance recorded" });
});

// POST /api/attendance/bulk — admin only, mark a whole class at once
// ("mark all present" / "mark all absent" from the UI)
const bulkSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  studentIds: z.array(z.string().min(1)).min(1),
  status: z.enum(["present", "absent", "leave"]),
});

router.post("/bulk", requireAuth, requireAdmin, (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { date, studentIds, status } = parsed.data;

  const stmt = db.prepare(`
    INSERT INTO attendance (student_id, date, status)
    VALUES (?, ?, ?)
    ON CONFLICT (student_id, date) DO UPDATE SET status = excluded.status, marked_at = datetime('now')
  `);
  for (const studentId of studentIds) {
    stmt.run(studentId, date, status);
  }

  res.json({ message: `Marked ${studentIds.length} students as ${status}` });
});

module.exports = router;
