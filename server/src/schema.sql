-- Divya Keerthi Academy — database schema
--
-- Design notes:
--   `users` holds login credentials only (one row per person who can log in).
--   `students` holds the academic record (admission details, fee totals).
--   A student row is created by the admin at admission time, with no
--   linked login yet. The parent/student later "claims" it by signing up
--   with the student_id + registered phone number, which creates their
--   `users` row and links it via student_id. This is what stops a
--   stranger from registering against someone else's record just by
--   guessing a sequential ID like S004.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
  student_id TEXT UNIQUE,              -- NULL for the admin row
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,                 -- e.g. 'S001'
  name TEXT NOT NULL,
  cls TEXT NOT NULL,
  roll_no INTEGER NOT NULL,
  parent_name TEXT,
  phone TEXT NOT NULL,                 -- used as the signup verification check
  admission_date TEXT NOT NULL,
  total_fee INTEGER NOT NULL DEFAULT 0,
  paid INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  date TEXT NOT NULL,                  -- 'YYYY-MM-DD'
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'leave')),
  marked_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id),
  UNIQUE (student_id, date)
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  recorded_by TEXT NOT NULL DEFAULT 'admin',  -- 'admin' or 'self' (online payment)
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,                 -- e.g. 'T1'
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  score INTEGER NOT NULL,
  FOREIGN KEY (test_id) REFERENCES tests(id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  UNIQUE (test_id, student_id, subject)
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,                 -- e.g. 'N001'
  cls TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  uploaded_on TEXT NOT NULL,
  size_label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_marks_test ON marks(test_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_notes_class ON notes(cls);
