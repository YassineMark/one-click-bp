import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set(["csv", "xlsx", "xls", "pdf"]);
const ALLOWED_MIME = new Set([
  "text/csv", "application/vnd.ms-excel", "application/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Nom de fichier généré côté serveur : jamais le nom fourni par le client.
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = (path.extname(file.originalname).slice(1) || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return cb(new Error("EXTENSION_NON_AUTORISEE"));
  // Le MIME type annoncé par le navigateur est indicatif et varie selon l'OS/le
  // navigateur (certains exports CSV/Excel arrivent en "application/octet-stream").
  // On le vérifie quand il est renseigné et reconnu, mais l'extension whitelist
  // + le parsing réel du contenu (server/services/balanceParser.js) restent la
  // véritable barrière de sécurité — jamais d'exécution du fichier dans tous les cas.
  if (file.mimetype && file.mimetype !== "application/octet-stream" && !ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error("TYPE_MIME_NON_AUTORISE"));
  }
  cb(null, true);
}

export const uploadBalance = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
});
