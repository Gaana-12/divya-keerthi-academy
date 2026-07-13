// auth.js — JWT signing/verification and password hashing helpers.

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  throw new Error(
    "JWT_SECRET is missing or too short. Set a long random value in your .env file. " +
    "You can generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
  );
}

const TOKEN_EXPIRY = "30d"; // how long a login stays valid before re-authenticating

function hashPassword(plain) {
  // 10 salt rounds is bcrypt's recommended baseline — strong enough for this
  // use case without making every login noticeably slow.
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
