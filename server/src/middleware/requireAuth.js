// middleware/requireAuth.js — verifies the JWT on protected routes.

const { verifyToken } = require("../auth");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No login token provided" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Login session is invalid or expired. Please log in again." });
  }

  req.user = payload; // { role: 'admin' } or { role: 'student', studentId: 'S001' }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// For routes a student can hit only on their own record (e.g. their own
// attendance), this checks the :studentId route param matches their token.
function requireOwnRecordOrAdmin(req, res, next) {
  if (req.user?.role === "admin") return next();
  if (req.user?.role === "student" && req.user.studentId === req.params.studentId) return next();
  return res.status(403).json({ error: "You can only access your own records" });
}

module.exports = { requireAuth, requireAdmin, requireOwnRecordOrAdmin };
