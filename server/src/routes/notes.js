// routes/notes.js

const express = require("express");
const { z } = require("zod");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/requireAuth");

const router = express.Router();

// GET /api/notes — anyone logged in (students see notes for their own
// class; admin can see/filter everything). Class filtering happens
// client-side same as today, to keep this endpoint simple — for an
// academy-sized dataset this is plenty fast without server-side filtering.
router.get("/", requireAuth, (req, res) => {
  const notes = db.prepare("SELECT * FROM notes ORDER BY created_at DESC").all();
  res.json(notes);
});

// POST /api/notes — admin only
// NOTE: this stores a metadata record only (title, subject, class), not an
// actual file. See the README for what's needed to support real file
// uploads (e.g. storing PDFs in S3 or similar object storage) — that's a
// meaningful enough change that it's broken out as a separate next step
// rather than bundled into this auth-focused build.
const newNoteSchema = z.object({
  cls: z.string().min(1),
  subject: z.enum(["maths", "physics", "chemistry", "biology", "social", "kannada", "english"]),
  title: z.string().min(1),
  sizeLabel: z.string().optional().default(""),
});

router.post("/", requireAuth, requireAdmin, (req, res) => {
  const parsed = newNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const row = db.prepare("SELECT id FROM notes ORDER BY id DESC LIMIT 1").get();
  const num = row ? parseInt(row.id.slice(1), 10) + 1 : 1;
  const id = "N" + String(num).padStart(3, "0");
  const uploadedOn = new Date().toISOString().slice(0, 10);

  db.prepare(`
    INSERT INTO notes (id, cls, subject, title, uploaded_on, size_label)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, parsed.data.cls, parsed.data.subject, parsed.data.title, uploadedOn, parsed.data.sizeLabel);

  const created = db.prepare("SELECT * FROM notes WHERE id = ?").get(id);
  res.status(201).json(created);
});

// DELETE /api/notes/:noteId — admin only
router.delete("/:noteId", requireAuth, requireAdmin, (req, res) => {
  const note = db.prepare("SELECT id FROM notes WHERE id = ?").get(req.params.noteId);
  if (!note) return res.status(404).json({ error: "Note not found" });
  db.prepare("DELETE FROM notes WHERE id = ?").run(req.params.noteId);
  res.json({ message: "Note removed" });
});

module.exports = router;
