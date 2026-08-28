import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { requireAuth } from "../middleware/auth.js";
import { uploadBalance, UPLOAD_DIR } from "../middleware/upload.js";
import {
  createProject, getProject, listProjects, updateProjectFormData, setProjectStatus, deleteProject,
} from "../services/projectService.js";
import { run, get, all } from "../db/db.js";
import { parseBalanceFile, analyserBalance } from "../services/balanceParser.js";
import { analyserProjet } from "../services/analysisService.js";
import { runGeneration, listDocuments, getDocumentPath, GENERATED_DIR, GENERATION_STEPS } from "../services/documentService.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.post("/", (req, res) => {
  const { projectType } = req.body || {};
  if (!["nouvelle_entreprise", "nouvelle_activite"].includes(projectType)) {
    return res.status(400).json({ error: "Type de projet invalide." });
  }
  const project = createProject(req.user.id, projectType);
  res.status(201).json({ project });
});

projectsRouter.get("/", (req, res) => {
  res.json({ projects: listProjects(req.user.id) });
});

projectsRouter.get("/:id", (req, res) => {
  const project = getProject(req.user.id, req.params.id);
  if (!project) return res.status(404).json({ error: "Projet introuvable." });
  const balance = get("SELECT id, original_filename, parse_status, parse_error, analysis_json, created_at FROM balance_uploads WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", [project.id]);
  res.json({ project, balanceUpload: balance ? { ...balance, analysis_json: balance.analysis_json ? JSON.parse(balance.analysis_json) : null } : null });
});

projectsRouter.patch("/:id", (req, res) => {
  const { formData, currentStep } = req.body || {};
  const project = updateProjectFormData(req.user.id, req.params.id, formData || {}, currentStep);
  if (!project) return res.status(404).json({ error: "Projet introuvable." });
  res.json({ project });
});

projectsRouter.delete("/:id", (req, res) => {
  const project = getProject(req.user.id, req.params.id);
  if (!project) return res.status(404).json({ error: "Projet introuvable." });

  // Nettoyage des fichiers sur disque avant suppression (les lignes en base
  // suivent automatiquement via ON DELETE CASCADE, mais les fichiers physiques
  // ne sont pas gérés par SQLite).
  const balanceRows = all("SELECT stored_filename FROM balance_uploads WHERE project_id = ?", [project.id]);
  for (const b of balanceRows) {
    const p = path.join(UPLOAD_DIR, b.stored_filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  const genDir = path.join(GENERATED_DIR, project.id);
  if (fs.existsSync(genDir)) fs.rmSync(genDir, { recursive: true, force: true });

  deleteProject(req.user.id, project.id);
  res.json({ ok: true });
});

// ---------- Upload de la Balance Générale (optionnel, nouvelle_activite) ----------
projectsRouter.post("/:id/balance-upload", (req, res) => {
  const project = getProject(req.user.id, req.params.id);
  if (!project) return res.status(404).json({ error: "Projet introuvable." });

  uploadBalance.single("balance")(req, res, async (err) => {
    if (err) {
      const messages = { EXTENSION_NON_AUTORISEE: "Format de fichier non autorisé (CSV, XLSX, XLS ou PDF uniquement).", TYPE_MIME_NON_AUTORISE: "Type de fichier non autorisé." };
      return res.status(400).json({ error: messages[err.message] || `Échec de l'upload : ${err.message}` });
    }
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });

    const buffer = fs.readFileSync(req.file.path);
    const parsed = await parseBalanceFile(buffer, req.file.mimetype, req.file.originalname);
    const uploadId = req.file.filename.split(".")[0];

    if (!parsed.ok) {
      run(
        "INSERT INTO balance_uploads (id, project_id, original_filename, stored_filename, mime_type, size_bytes, parse_status, parse_error) VALUES (?, ?, ?, ?, ?, ?, 'failed', ?)",
        [uploadId, project.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, parsed.error]
      );
      return res.status(422).json({ error: parsed.error });
    }

    const analysis = analyserBalance(parsed.rows);
    run(
      "INSERT INTO balance_uploads (id, project_id, original_filename, stored_filename, mime_type, size_bytes, parse_status, analysis_json) VALUES (?, ?, ?, ?, ?, ?, 'ok', ?)",
      [uploadId, project.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, JSON.stringify(analysis)]
    );
    updateProjectFormData(req.user.id, project.id, { situationFinanciereActuelle: { balanceUploadId: uploadId } });
    res.json({ uploadId, analysis, detection: parsed.detection });
  });
});

// ---------- Écran de récapitulatif : analyse sans génération de fichiers ----------
projectsRouter.get("/:id/review", (req, res) => {
  const project = getProject(req.user.id, req.params.id);
  if (!project) return res.status(404).json({ error: "Projet introuvable." });
  const balanceRow = get("SELECT analysis_json FROM balance_uploads WHERE project_id = ? AND parse_status = 'ok' ORDER BY created_at DESC LIMIT 1", [project.id]);
  const balanceAnalysis = balanceRow ? JSON.parse(balanceRow.analysis_json) : null;
  const bp = analyserProjet(project.form_data, project.project_type, balanceAnalysis);
  res.json({ bp });
});

// ---------- Génération des documents (flux d'étapes réel via SSE) ----------
projectsRouter.get("/:id/generate/stream", async (req, res) => {
  const project = getProject(req.user.id, req.params.id);
  if (!project) return res.status(404).json({ error: "Projet introuvable." });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send("init", { steps: GENERATION_STEPS });

  try {
    const balanceRow = get("SELECT analysis_json FROM balance_uploads WHERE project_id = ? AND parse_status = 'ok' ORDER BY created_at DESC LIMIT 1", [project.id]);
    const balanceAnalysis = balanceRow ? JSON.parse(balanceRow.analysis_json) : null;

    const { documents, bloque } = await runGeneration(project, balanceAnalysis, (stepId, status, detail) => {
      send("step", { stepId, status, detail: detail || null });
    });

    if (bloque) {
      send("bloque", { message: "Des erreurs bloquantes empêchent la génération. Retournez à l'étape de vérification." });
    } else {
      setProjectStatus(req.user.id, project.id, "generated");
      send("done", { documents });
    }
  } catch (err) {
    console.error(err);
    send("erreur", { message: "Une erreur est survenue pendant la génération des documents." });
  } finally {
    res.end();
  }
});

projectsRouter.get("/:id/documents", (req, res) => {
  const project = getProject(req.user.id, req.params.id);
  if (!project) return res.status(404).json({ error: "Projet introuvable." });
  res.json({ documents: listDocuments(project.id) });
});

projectsRouter.get("/:id/documents/:docId/download", (req, res) => {
  const project = getProject(req.user.id, req.params.id);
  if (!project) return res.status(404).json({ error: "Projet introuvable." });
  const doc = get("SELECT * FROM generated_documents WHERE id = ? AND project_id = ?", [req.params.docId, project.id]);
  if (!doc) return res.status(404).json({ error: "Document introuvable." });
  const filePath = getDocumentPath(doc);
  if (!fs.existsSync(filePath)) return res.status(410).json({ error: "Fichier non disponible." });
  const ext = doc.doc_type === "xlsx" ? ".xlsx" : ".pdf";
  const safeLabel = doc.label.replace(/[^a-zA-Z0-9 _\-]/g, "").trim() || "document";
  res.download(filePath, `${safeLabel}${ext}`);
});
