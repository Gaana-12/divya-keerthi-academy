// integration_test.js — drives the backend exactly the way the frontend's
// api.js module does, to validate the full real user journey end-to-end.

const BASE = "http://localhost:4000/api";

async function req(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

async function main() {
  // 1. First-time setup
  let r = await req("/auth/setup-status");
  assert(r.data.setupComplete === false, "Setup status starts as incomplete");

  r = await req("/auth/setup", { method: "POST", body: { password: "AcademyAdmin2026!" } });
  assert(r.status === 201, "Admin setup succeeds");

  r = await req("/auth/setup", { method: "POST", body: { password: "Whatever12345" } });
  assert(r.status === 409, "Second setup attempt is blocked");

  // 2. Admin login
  r = await req("/auth/admin-login", { method: "POST", body: { password: "wrong" } });
  assert(r.status === 401, "Admin login rejects wrong password");

  r = await req("/auth/admin-login", { method: "POST", body: { password: "AcademyAdmin2026!" } });
  assert(r.status === 200 && r.data.token, "Admin login succeeds and returns a token");
  const adminToken = r.data.token;

  // 3. Admission — admin creates a student record
  r = await req("/students", {
    method: "POST", token: adminToken,
    body: { name: "Ananya Gowda", cls: "Class 10", rollNo: 1, parentName: "Suresh Gowda", phone: "9876543210", totalFee: 32000 },
  });
  assert(r.status === 201 && r.data.id === "S001", "Admission creates student S001");

  r = await req("/students", {
    method: "POST", token: adminToken,
    body: { name: "Rohan Reddy", cls: "Class 10", rollNo: 2, parentName: "Lakshmi Reddy", phone: "9876500001", totalFee: 32000 },
  });
  assert(r.status === 201 && r.data.id === "S002", "Admission creates student S002 with sequential ID");

  r = await req("/students", { token: adminToken });
  assert(r.data.length === 2, "Admin sees both students in the roster");

  // 4. Parent signup — claiming the record
  r = await req("/auth/student-signup", { method: "POST", body: { studentId: "S001", phone: "0000000000", password: "parentpass123" } });
  assert(r.status === 401, "Signup rejects wrong phone number");

  r = await req("/auth/student-signup", { method: "POST", body: { studentId: "S001", phone: "9876543210", password: "parentpass123" } });
  assert(r.status === 201 && r.data.token, "Signup succeeds with correct ID + phone");
  const studentToken = r.data.token;

  r = await req("/auth/student-signup", { method: "POST", body: { studentId: "S001", phone: "9876543210", password: "different456" } });
  assert(r.status === 409, "Second signup for the same student is blocked");

  // 5. Student login
  r = await req("/auth/student-login", { method: "POST", body: { studentId: "S001", password: "wrongpass" } });
  assert(r.status === 401, "Student login rejects wrong password");

  r = await req("/auth/student-login", { method: "POST", body: { studentId: "S001", password: "parentpass123" } });
  assert(r.status === 200 && r.data.token, "Student login succeeds with correct password");

  // 6. Access boundaries
  r = await req("/students", { token: studentToken });
  assert(r.status === 403, "Student is blocked from the full roster");

  r = await req("/students/S001", { token: studentToken });
  assert(r.status === 200 && r.data.id === "S001", "Student can view their own record");

  r = await req("/students/S002", { token: studentToken });
  assert(r.status === 403, "Student is blocked from another student's record");

  // 7. Attendance
  r = await req("/attendance", { method: "POST", token: adminToken, body: { date: "2026-06-17", studentId: "S001", status: "present" } });
  assert(r.status === 200, "Admin marks attendance");

  r = await req("/attendance/bulk", { method: "POST", token: adminToken, body: { date: "2026-06-17", studentIds: ["S001", "S002"], status: "present" } });
  assert(r.status === 200, "Admin bulk-marks attendance");

  r = await req("/attendance/S001", { token: studentToken });
  assert(r.status === 200 && Array.isArray(r.data) && r.data.length === 1, "Student sees their own attendance history");

  r = await req("/attendance", { token: studentToken });
  assert(r.status === 403, "Student is blocked from the full attendance map");

  // 8. Fees
  r = await req("/fees/S001/pay", { method: "POST", token: adminToken, body: { amount: 10000 } });
  assert(r.status === 200 && r.data.paid === 10000, "Admin records a payment");

  r = await req("/fees/S001/pay", { method: "POST", token: studentToken, body: { amount: 5000 } });
  assert(r.status === 200 && r.data.paid === 15000, "Student pays via 'Pay now' and balance accumulates correctly");

  r = await req("/fees/S001/pay", { method: "POST", token: studentToken, body: { amount: 999999 } });
  assert(r.status === 400, "Overpayment beyond balance is rejected");

  r = await req("/fees/S002/pay", { method: "POST", token: studentToken, body: { amount: 1000 } });
  assert(r.status === 403, "Student cannot pay for another student's record");

  // 9. Marks
  r = await req("/marks/tests", { method: "POST", token: adminToken, body: { name: "Unit Test 1", date: "2026-06-10" } });
  assert(r.status === 201 && r.data.id === "T1", "Admin creates a test");

  r = await req("/marks/T1", { method: "POST", token: adminToken, body: { studentId: "S001", subject: "maths", score: 88 } });
  assert(r.status === 200, "Admin sets a mark");

  r = await req("/marks/T1", { token: studentToken });
  assert(r.status === 200 && r.data["S001"]?.maths === 88, "Student sees only their own marks for the test");

  // 10. Notes
  r = await req("/notes", { method: "POST", token: adminToken, body: { cls: "Class 10", subject: "maths", title: "Quadratic Equations", sizeLabel: "2.1 MB" } });
  assert(r.status === 201, "Admin uploads a note");

  r = await req("/notes", { method: "POST", token: studentToken, body: { cls: "Class 10", subject: "maths", title: "Hack attempt" } });
  assert(r.status === 403, "Student is blocked from uploading notes");

  r = await req("/notes", { token: studentToken });
  assert(r.status === 200 && r.data.length === 1, "Student can view uploaded notes");

  // 11. Deletion cascade
  r = await req("/students/S002", { method: "DELETE", token: adminToken });
  assert(r.status === 200, "Admin deletes a student");

  r = await req("/students", { token: adminToken });
  assert(r.data.length === 1, "Roster reflects the deletion");

  console.log("\n=== Integration test complete ===");
}

main().catch(e => {
  console.error("Test crashed:", e);
  process.exitCode = 1;
});
