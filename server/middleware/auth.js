import { verifyToken, getUserById, COOKIE_NAME } from "../services/authService.js";

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "NON_AUTHENTIFIE", message: "Veuillez vous connecter." });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "SESSION_INVALIDE", message: "Votre session a expiré, veuillez vous reconnecter." });
  const user = getUserById(payload.sub);
  if (!user) return res.status(401).json({ error: "UTILISATEUR_INTROUVABLE" });
  req.user = user;
  next();
}
