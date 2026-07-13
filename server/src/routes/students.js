// routes/students.js

const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { requireAuth, requireAdmin, requireOwnRecordOrAdmin } = require("../middleware/requireAuth");

const router = express.Router();

function nextStudentId() {
  const row = db.prepare("SELECT id FROM students ORDER BY id DESC LIMIT 1").get();
  if (!row) return "S001";
  const num = parseInt(row.id.slice(1), 10) + 1;
  return "S" + String(num).padStart(3, "0");
}

// GET /api/students — admin only, full roster
router.get("/", requireAuth, requireAdmin, (req, res) => {
  const students = db.prepare("SELECT * FROM students ORDER BY cls, roll_no").all();
  res.json(students);
});

// GET /api/students/:studentId — admin, or the student themself
router.get("/:studentId", requireAuth, requireOwnRecordOrAdmin, (req, res) => {
  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.studentId);
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

// POST /api/students — admin only, new admission
const newStudentSchema = z.object({
  name: z.string().min(1),
  cls: z.string().min(1),
  rollNo: z.number().int().positive(),
  parentName: z.string().optional().default(""),
  phone: z.string().min(1),
  totalFee: z.number().int().nonnegative(),
});

router.post("/", requireAuth, requireAdmin, (req, res) => {
  const parsed = newStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, cls, rollNo, parentName, phone, totalFee } = parsed.data;
  const id = nextStudentId();
  const admissionDate = new Date().toISOString().slice(0, 10);

  db.prepare(`
    INSERT INTO students (id, name, cls, roll_no, parent_name, phone, admission_date, total_fee, paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, name, cls, rollNo, parentName, phone, admissionDate, totalFee);

  const created = db.prepare("SELECT * FROM students WHERE id = ?").get(id);
  res.status(201).json(created);
});

// DELETE /api/students/:studentId — admin only
router.delete("/:studentId", requireAuth, requireAdmin, (req, res) => {
  const { studentId } = req.params;
  const student = db.prepare("SELECT id FROM students WHERE id = ?").get(studentId);
  if (!student) return res.status(404).json({ error: "Student not found" });

  // Clean up dependent rows first (no ON DELETE CASCADE configured, so this
  // is done explicitly to avoid leaving orphaned records behind).
  db.prepare("DELETE FROM attendance WHERE student_id = ?").run(studentId);
  db.prepare("DELETE FROM fee_payments WHERE student_id = ?").run(studentId);
  db.prepare("DELETE FROM marks WHERE student_id = ?").run(studentId);
  db.prepare("DELETE FROM users WHERE student_id = ?").run(studentId);
  db.prepare("DELETE FROM students WHERE id = ?").run(studentId);

  res.json({ message: "Student and related records removed" });
});

module.exports = router;
