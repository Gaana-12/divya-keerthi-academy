# Divya Keerthi Academy — Student Management App

A full student management system for Divya Keerthi Academy (Classes 8 to
2nd PUC), with a real backend, a real database, and real login accounts
for the admin and for students/parents.

This is two separate projects that work together:

```
divya-keerthi-academy/
├── server/      ← the backend (API + database)
└── frontend/    ← the web app (what people actually see and use)
```

The backend needs to be running for the frontend to work — they're not
independent. Run both, in two separate terminal windows.

## What's included

**Admin portal**
- Dashboard with today's attendance and fee collection summary
- Daily attendance marking, by class, with present / absent / leave
- Student records: search, filter by class, new admissions
- Fee tracking and payment recording
- Marks entry across all 7 subjects (Maths, Physics, Chemistry, Biology,
  Social Science, Kannada, English), per test
- Notes upload, organized by class and subject

**Student / Parent portal**
- Self-service signup using Student ID + the phone number on file, so
  only someone who actually knows a student's real details can claim
  their account
- Attendance percentage and day-by-day history
- Fee status with a "Pay now" flow and pending amount
- Browse notes uploaded by the academy

**Real accounts, not a demo.** Passwords are hashed (never stored as
plain text), admin sets up their own password on first run, and login
sessions persist properly — closing the tab and coming back later keeps
you logged in.

## Quick start (running it locally)

You'll need [Node.js](https://nodejs.org) installed — version 18 or
newer. Check with `node -v` in your terminal.

**1. Start the backend** (in one terminal window):

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` in a text editor and fill in `JWT_SECRET` with a random
value. Generate one by running:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the output after `JWT_SECRET=` in `.env`, then start the server:

```bash
npm start
```

You should see `Divya Keerthi Academy server running on http://localhost:4000`.
Leave this terminal open.

**2. Start the frontend** (in a second terminal window):

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open the URL it shows you (usually `http://localhost:5173`).

**3. First-time setup.** The very first time you open the app, it'll ask
you to create an admin password — this only happens once, ever. After
that, you (the admin) log in with that password, admit students, and
share each student's ID with their parent so they can sign up using that
ID plus the phone number you entered for them.

## How accounts work

- **Admin:** one account, set up once via the password-creation screen
  on first run. There's no separate signup for admin — if you ever need
  to reset it, see "Resetting things" below.
- **Students/parents:** the admin creates the student's academic record
  during admission (name, class, fee, phone number). The parent then
  visits the login screen, picks "First time here," and signs up using
  the Student ID the admin gave them plus the phone number on file. This
  two-step process is what stops a stranger from registering against
  someone else's record just by guessing a Student ID like S004.

## Deploying this online

To make this reachable from outside your own computer (so parents can
actually log in from home), you need to host both pieces somewhere:

- **Backend:** any Node hosting works — Render, Railway, Fly.io, or a
  basic VPS are all reasonable starting points for something this size.
  Set the same environment variables from `server/.env.example` in your
  host's dashboard (don't upload your `.env` file itself). Set
  `FRONTEND_URL` to your real frontend's URL once you have it, so CORS
  allows the browser to talk to the API.
- **Frontend:** Vercel or Netlify both work well for a Vite app like
  this — connect your repository and they'll build it automatically.
  Set `VITE_API_URL` in their environment variable settings to your
  deployed backend's URL (e.g. `https://your-backend.onrender.com/api`).
- **Database:** the backend uses SQLite, stored as a single file
  (`server/data/academy.db`). This is fine to start, but make sure
  whatever host you pick keeps that file on persistent disk — some
  free hosting tiers wipe the filesystem on every redeploy, which would
  silently delete all your data. Check your host's docs for this before
  relying on it for real student data, and set up regular backups of
  that file regardless.

This part — actually picking a host and deploying — has enough
host-specific details that it's worth doing as its own next step once
you've confirmed everything works the way you want locally.

## Verifying everything works

The backend comes with an automated test that exercises the entire
flow — setup, both login types, signup verification, attendance, fees,
marks, notes, and all the access-control rules — against a real running
server. Useful to run after any changes, or just to confirm a fresh
install is working correctly:

```bash
cd server
npm start            # in one terminal, leave running
npm run test:integration   # in another terminal
```

You should see 31 checkmarks and "Integration test complete."

## What's still a placeholder

Being upfront about what's real and what isn't yet:

- **"Pay now" doesn't move real money.** It updates the recorded fee
  balance immediately, which is useful for tracking, but there's no
  payment gateway (Razorpay, Stripe, etc.) connected. If you want
  parents to actually pay online, that's a real integration to add later
  — happy to help with that when you're ready.
- **Notes upload doesn't store actual files yet.** It saves the title,
  subject, and class as a record students can see, but there's no file
  attached. Adding real PDF storage (e.g. via a service like S3 or
  Cloudinary) is a reasonable next addition.
- **One admin account.** This was built for a single admin. If you later
  want multiple staff logins with their own credentials, that's a
  moderate change to the backend's auth model, not a quick toggle.

## Resetting things

**Forgot the admin password:** there's no "forgot password" flow yet.
The fastest fix during early testing is deleting `server/data/academy.db`
and restarting the server — this wipes everything (all students,
attendance, fees, the lot), so only do this before you have real data in
there. For a live academy, a proper "admin password reset" flow is
worth adding before this matters.

**Wiping all data to start fresh:** stop the server, delete
`server/data/academy.db`, start the server again. A new, empty database
is created automatically.

## Project structure

```
divya-keerthi-academy/
├── server/
│   ├── index.js              # server entry point
│   ├── integration_test.js   # automated end-to-end test
│   ├── .env.example          # copy to .env and fill in
│   └── src/
│       ├── db.js             # database connection + schema setup
│       ├── schema.sql        # table definitions
│       ├── auth.js           # password hashing, JWT signing
│       ├── middleware/
│       │   └── requireAuth.js
│       └── routes/
│           ├── auth.js       # setup, login, signup
│           ├── students.js
│           ├── attendance.js
│           ├── fees.js
│           ├── marks.js
│           └── notes.js
│
└── frontend/
    ├── index.html
    ├── .env.example           # copy to .env and fill in
    └── src/
        ├── main.jsx           # mounts the app
        ├── api.js             # talks to the backend
        └── App.jsx            # everything else — UI, all views
```
