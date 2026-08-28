import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { run, get } from "../db/db.js";

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
if (!process.env.JWT_SECRET) {
  console.warn("[auth] JWT_SECRET n'est pas défini dans l'environnement : un secret temporaire a été généré pour cette exécution (les sessions seront invalidées au redémarrage). Définissez JWT_SECRET dans .env pour la production.");
}

const TOKEN_TTL = "7d";
export const COOKIE_NAME = "ocbp_session";

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function createUser({ email, password, fullName }) {
  const existing = get("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) throw new Error("EMAIL_TAKEN");
  const id = crypto.randomUUID();
  return hashPassword(password).then((hash) => {
    run("INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)", [id, email, hash, fullName]);
    return { id, email, fullName };
  });
}

export async function authenticate(email, password) {
  const user = get("SELECT * FROM users WHERE email = ?", [email]);
  if (!user) return null;
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;
  return { id: user.id, email: user.email, fullName: user.full_name };
}

export function getUserById(id) {
  const user = get("SELECT id, email, full_name FROM users WHERE id = ?", [id]);
  return user ? { id: user.id, email: user.email, fullName: user.full_name } : null;
}
