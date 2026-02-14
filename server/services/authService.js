const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const USERS_DIR = path.join(__dirname, "..", "storage", "users");
const USERS_FILE = path.join(USERS_DIR, "users.json");
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || "7d";

function getJwtSecret() {
  return process.env.JWT_SECRET || "deadlock-dev-secret-change-me";
}

function ensureUsersFile() {
  fs.mkdirSync(USERS_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
  }
}

function readUsers() {
  ensureUsersFile();
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function writeUsers(users) {
  ensureUsersFile();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function safeUser(user) {
  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

async function registerUser({ email, password, name }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  if (!password || String(password).length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const users = readUsers();
  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error("Email already registered");
  }

  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    userId: randomUUID(),
    email: normalizedEmail,
    name: String(name || normalizedEmail.split("@")[0] || "User").trim(),
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);
  writeUsers(users);

  return safeUser(user);
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    throw new Error("Email and password are required");
  }

  const users = readUsers();
  const user = users.find((item) => item.email === normalizedEmail);
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  const token = jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      name: user.name,
    },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL }
  );

  return {
    token,
    user: safeUser(user),
  };
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  registerUser,
  loginUser,
  verifyToken,
};
