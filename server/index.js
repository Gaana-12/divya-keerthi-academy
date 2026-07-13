// index.js — server entry point.

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./src/routes/auth");
const studentsRoutes = require("./src/routes/students");
const attendanceRoutes = require("./src/routes/attendance");
const feesRoutes = require("./src/routes/fees");
const marksRoutes = require("./src/routes/marks");
const notesRoutes = require("./src/routes/notes");

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/fees", feesRoutes);
app.use("/api/marks", marksRoutes);
app.use("/api/notes", notesRoutes);

// Centralized error handler — catches anything that wasn't already
// caught and turned into a clean JSON response, so a bug never leaks a
// raw stack trace to the frontend.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Divya Keerthi Academy server running on http://localhost:${PORT}`);
});
