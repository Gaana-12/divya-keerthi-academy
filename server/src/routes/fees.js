// routes/fees.js

const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { requireAuth, requireAdmin, requireOwnRecordOrAdmin } = require("../middleware/requireAuth");

const router = express.Router();

// POST /api/fees/:studentId/pay
// Admin can record any payment (cash collected in person).
// A student can also call this for their own record — this is the
// "Pay now" button in the UI. NOTE: this only updates the recorded fee
// balance; it does not move real money. See the README for what's needed
// to connect a real payment gateway (Razorpay/Stripe etc.) before relying
// on this for actual collections.
const paySchema = z.object({
  amount: z.number().int().positive(),
});

router.post("/:studentId/pay", requireAuth, requireOwnRecordOrAdmin, (req, res) => {
  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { studentId } = req.params;
  const { amount } = parsed.data;

  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(studentId);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const due = student.total_fee - student.paid;
  if (amount > due) {
    return res.status(400).json({ error: `Amount exceeds pending balance of ₹${due}` });
  }

  const recordedBy = req.user.role === "admin" ? "admin" : "self";

  db.prepare("INSERT INTO fee_payments (student_id, amount, recorded_by) VALUES (?, ?, ?)")
    .run(studentId, amount, recordedBy);
  db.prepare("UPDATE students SET paid = paid + ? WHERE id = ?").run(amount, studentId);

  const updated = db.prepare("SELECT * FROM students WHERE id = ?").get(studentId);
  res.json(updated);
});

// GET /api/fees/:studentId/history — admin, or the student themself
router.get("/:studentId/history", requireAuth, requireOwnRecordOrAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT amount, paid_at, recorded_by FROM fee_payments WHERE student_id = ? ORDER BY paid_at DESC"
  ).all(req.params.studentId);
  res.json(rows);
});

module.exports = router;
