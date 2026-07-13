// api.js — talks to the backend. Handles the auth token and wraps fetch
// calls so the rest of the app doesn't need to think about headers, base
// URLs, or error shapes.

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const TOKEN_KEY = "dka_token";
const ROLE_KEY = "dka_role";
const STUDENT_ID_KEY = "dka_student_id";

export function saveSession({ token, role, studentId }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  if (studentId) localStorage.setItem(STUDENT_ID_KEY, studentId);
  else localStorage.removeItem(STUDENT_ID_KEY);
}

export function loadSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const role = localStorage.getItem(ROLE_KEY);
  const studentId = localStorage.getItem(STUDENT_ID_KEY);
  if (!token || !role) return null;
  return { token, role, studentId: studentId || undefined };
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(STUDENT_ID_KEY);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const session = loadSession();
    if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // No JSON body (e.g. some 204 responses) — fine, leave data as null.
  }

  if (!res.ok) {
    // A 401 on an authenticated request usually means the token expired —
    // clear the stale session so the app falls back to the login screen
    // instead of getting stuck in a broken logged-in-but-rejected state.
    if (res.status === 401 && auth) clearSession();
    throw new ApiError(data?.error || "Something went wrong", res.status);
  }

  return data;
}

export const api = {
  // --- auth ---
  setupStatus: () => request("/auth/setup-status", { auth: false }),
  setupAdmin: (password) => request("/auth/setup", { method: "POST", body: { password }, auth: false }),
  adminLogin: (password) => request("/auth/admin-login", { method: "POST", body: { password }, auth: false }),
  studentSignup: (studentId, phone, password) =>
    request("/auth/student-signup", { method: "POST", body: { studentId, phone, password }, auth: false }),
  studentLogin: (studentId, password) =>
    request("/auth/student-login", { method: "POST", body: { studentId, password }, auth: false }),

  // --- students ---
  getStudents: () => request("/students"),
  getStudent: (id) => request(`/students/${id}`),
  addStudent: (student) => request("/students", { method: "POST", body: student }),
  removeStudent: (id) => request(`/students/${id}`, { method: "DELETE" }),

  // --- attendance ---
  getAllAttendance: () => request("/attendance"),
  getStudentAttendance: (studentId) => request(`/attendance/${studentId}`),
  markAttendance: (date, studentId, status) =>
    request("/attendance", { method: "POST", body: { date, studentId, status } }),
  markAttendanceBulk: (date, studentIds, status) =>
    request("/attendance/bulk", { method: "POST", body: { date, studentIds, status } }),

  // --- fees ---
  payFee: (studentId, amount) => request(`/fees/${studentId}/pay`, { method: "POST", body: { amount } }),
  getFeeHistory: (studentId) => request(`/fees/${studentId}/history`),

  // --- marks ---
  getTests: () => request("/marks/tests"),
  addTest: (name, date) => request("/marks/tests", { method: "POST", body: { name, date } }),
  getMarksForTest: (testId) => request(`/marks/${testId}`),
  setMark: (testId, studentId, subject, score) =>
    request(`/marks/${testId}`, { method: "POST", body: { studentId, subject, score } }),

  // --- notes ---
  getNotes: () => request("/notes"),
  addNote: (note) => request("/notes", { method: "POST", body: note }),
  removeNote: (id) => request(`/notes/${id}`, { method: "DELETE" }),
};

export { ApiError };
