// db.js — database connection and setup.
//
// Uses Node's built-in `node:sqlite` (available in Node 22.5+, no native
// compilation needed — good for getting started anywhere, including most
// free hosting tiers). It's still marked "experimental" by Node, meaning
// the API could change in a future Node version, though it's been stable
// across recent releases.
//
// If your host's Node version doesn't support node:sqlite, or you'd rather
// use a more battle-tested driver, switch to `better-sqlite3`:
//   1. npm install better-sqlite3
//   2. Replace this file's contents with:
//        const Database = require("better-sqlite3");
//        const db = new Database(DB_PATH);
//        module.exports = db;
//      (better-sqlite3's API is intentionally near-identical to node:sqlite
//      for .prepare()/.run()/.get()/.all(), so the rest of the codebase
//      should need little to no change.)

const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "academy.db");

// Ensure the data directory exists before SQLite tries to create the file.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

// Apply schema on every boot — all statements use CREATE TABLE IF NOT EXISTS,
// so this is safe to re-run and won't wipe existing data.
const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");
db.exec(schema);

module.exports = db;
