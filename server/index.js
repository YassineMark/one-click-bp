import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./db/db.js"; // initialise la base au démarrage
import { authRouter } from "./routes/auth.routes.js";
import { wizardRouter } from "./routes/wizard.routes.js";
import { projectsRouter } from "./routes/projects.routes.js";
import { chatbotRouter } from "./routes/chatbot.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/wizard", wizardRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/chatbot", chatbotRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use(express.static(path.resolve(__dirname, "../public")));

// Erreurs multer / JSON malformé, etc.
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Requête trop volumineuse." });
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`One Click BP — serveur démarré sur http://localhost:${PORT}`);
});
