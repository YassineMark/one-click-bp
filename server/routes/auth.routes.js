import { Router } from "express";
import { createUser, authenticate, signToken, COOKIE_NAME } from "../services/authService.js";
import { isValidEmail, isValidPassword, sanitizeString } from "../utils/validators.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

authRouter.post("/register", async (req, res) => {
  const { email, password, fullName } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: "Adresse email invalide." });
  if (!isValidPassword(password)) return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
  const cleanName = sanitizeString(fullName, 200).trim();
  if (!cleanName) return res.status(400).json({ error: "Le nom complet est requis." });

  try {
    const user = await createUser({ email: email.toLowerCase().trim(), password, fullName: cleanName });
    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    res.status(201).json({ user });
  } catch (err) {
    if (err.message === "EMAIL_TAKEN") return res.status(409).json({ error: "Un compte existe déjà avec cet email." });
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la création du compte." });
  }
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== "string") return res.status(400).json({ error: "Identifiants invalides." });
  const user = await authenticate(email.toLowerCase().trim(), password);
  if (!user) return res.status(401).json({ error: "Email ou mot de passe incorrect." });
  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ user });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
