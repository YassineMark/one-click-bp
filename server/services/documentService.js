import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { run, all } from "../db/db.js";
import { analyserProjet } from "./analysisService.js";
import { buildEntrepreneurWorkbook } from "./excelBuilder/entrepreneurWorkbook.js";
import { buildBankWorkbook } from "./excelBuilder/bankWorkbook.js";
import { buildAideWorkbook } from "./excelBuilder/aideWorkbook.js";
import { buildBankPdf } from "./pdfBuilder/bankPdf.js";
import { buildAidePdf } from "./pdfBuilder/aidePdf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.resolve(__dirname, "../../uploads/generated");
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });

function saveFile(projectId, buffer, ext) {
  const dir = path.join(GENERATED_DIR, projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return filename;
}

function recordDocument(projectId, space, docType, label, storedFilename, langue, programmeId = null) {
  const id = crypto.randomUUID();
  run(
    "INSERT INTO generated_documents (id, project_id, space, doc_type, programme_id, label, stored_filename, langue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, projectId, space, docType, programmeId, label, storedFilename, langue]
  );
  return { id, space, docType, label, langue, programmeId };
}

const STEPS = [
  { id: "analyse_projet", label: "Analyse du projet" },
  { id: "hypotheses", label: "Construction des hypothèses" },
  { id: "analyse_financiere", label: "Analyse financière" },
  { id: "analyse_marche", label: "Analyse du marché" },
  { id: "analyse_financement", label: "Analyse de financement" },
  { id: "verification_coherence", label: "Vérification de cohérence" },
  { id: "eligibilite_aides", label: "Analyse de l'éligibilité aux aides" },
  { id: "generation_documents", label: "Génération des documents" },
];
export { STEPS as GENERATION_STEPS };

/**
 * Exécute la génération complète d'un projet. `onStep(stepId, status, detail)`
 * est appelé pour CHAQUE phase réellement exécutée (pas de simulation) afin
 * que l'écran de traitement reflète un travail effectif.
 */
export async function runGeneration(project, balanceAnalysis, onStep = () => {}) {
  const formData = project.form_data;
  const projectType = project.project_type;

  onStep("analyse_projet", "en_cours");
  onStep("analyse_projet", "termine");

  onStep("hypotheses", "en_cours");
  const bp = analyserProjet(formData, projectType, balanceAnalysis);
  onStep("hypotheses", "termine", { nbHypotheses: bp.hypotheses.length });

  onStep("analyse_financiere", "en_cours");
  onStep("analyse_financiere", "termine", { caAnnee1: Math.round(bp.cpc.ca[0]), resultatNetAnnee1: Math.round(bp.cpc.resultatNet[0]) });

  onStep("analyse_marche", "en_cours");
  onStep("analyse_marche", "termine");

  onStep("analyse_financement", "en_cours");
  onStep("analyse_financement", "termine", { besoinTotal: Math.round(bp.pf.totalEmplois), ecart: Math.round(bp.pf.ecart) });

  onStep("verification_coherence", "en_cours");
  onStep("verification_coherence", "termine", { erreurs: bp.validation.erreurs.length, avertissements: bp.validation.avertissements.length });
  if (bp.validation.bloquant) {
    onStep("generation_documents", "annule", { raison: "Des erreurs bloquantes empêchent la génération." });
    return { bp, documents: [], bloque: true };
  }

  onStep("eligibilite_aides", "en_cours");
  onStep("eligibilite_aides", "termine", { programmes: bp.eligibilites.programmes.map((p) => ({ nom: p.nom, statut: p.statut })) });

  onStep("generation_documents", "en_cours");
  const documents = [];
  const lang = bp.langueBusinessPlan;

  // --- Espace Entrepreneur ---
  const wbEntrepreneur = await buildEntrepreneurWorkbook(bp, formData, lang);
  const bufEntrepreneur = await wbEntrepreneur.xlsx.writeBuffer();
  const fnEntrepreneur = saveFile(project.id, bufEntrepreneur, "xlsx");
  documents.push(recordDocument(project.id, "entrepreneur", "xlsx", "Business Plan Entrepreneur (.xlsx)", fnEntrepreneur, lang));

  // --- Espace Institution Financière (toujours en français) ---
  const wbBanque = await buildBankWorkbook(bp, formData);
  const bufBanque = await wbBanque.xlsx.writeBuffer();
  const fnBanque = saveFile(project.id, bufBanque, "xlsx");
  documents.push(recordDocument(project.id, "banque", "xlsx", "Business Plan Banque (.xlsx)", fnBanque, "fr"));

  const pdfBanque = await buildBankPdf(bp, formData);
  const fnBanquePdf = saveFile(project.id, pdfBanque, "pdf");
  documents.push(recordDocument(project.id, "banque", "pdf", "Business Plan Banque (.pdf)", fnBanquePdf, "fr"));

  // --- Espace Aide aux entrepreneurs (toujours en français) ---
  for (const programme of bp.eligibilites.programmes) {
    const pdfAide = await buildAidePdf(bp, formData, programme);
    const fnAidePdf = saveFile(project.id, pdfAide, "pdf");
    documents.push(recordDocument(project.id, "aide", "pdf", `${programme.nom} — Analyse d'éligibilité (.pdf)`, fnAidePdf, "fr", programme.id));

    if (programme.statut === "eligible" || programme.statut === "zone_grise") {
      const wbAide = await buildAideWorkbook(bp, formData, programme);
      const bufAide = await wbAide.xlsx.writeBuffer();
      const fnAideXlsx = saveFile(project.id, bufAide, "xlsx");
      documents.push(recordDocument(project.id, "aide", "xlsx", `${programme.nom} — Dossier (.xlsx)`, fnAideXlsx, "fr", programme.id));
    }
  }

  onStep("generation_documents", "termine", { nbDocuments: documents.length });

  return { bp, documents, bloque: false };
}

export function listDocuments(projectId) {
  const rows = all("SELECT id, space, doc_type, programme_id, label, stored_filename, langue, created_at FROM generated_documents WHERE project_id = ? ORDER BY created_at ASC", [projectId]);
  // Normalisé en camelCase pour correspondre exactement aux documents renvoyés par l'événement SSE "done".
  return rows.map((r) => ({
    id: r.id, space: r.space, docType: r.doc_type, programmeId: r.programme_id,
    label: r.label, langue: r.langue, createdAt: r.created_at,
  }));
}

export function getDocumentPath(doc) {
  return path.join(GENERATED_DIR, doc.project_id || doc.projectId, doc.stored_filename);
}

export { GENERATED_DIR };
