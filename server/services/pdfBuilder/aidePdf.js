import PDFDocument from "pdfkit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fmtDH } from "../../utils/i18n.js";

const LOGO_WHITE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../public/img/logo-white.png");

/**
 * Générateur du dossier PDF "Aide" (analyse d'éligibilité à un dispositif
 * public — INTELAKA, FORSA...). Toujours en français. Ce fichier ne fait que
 * mettre en forme et traduire les données déjà calculées par
 * `server/services/eligibilityEngine.js` / `server/config/aidesMaroc.js` :
 * aucune règle d'éligibilité n'est ajoutée ou recalculée ici.
 *
 * Pagination : même technique que bankPdf.js — un seul rendu du contenu,
 * `bufferPages: true`, puis une passe finale (`finalizePages`) qui revient
 * sur chaque page via `doc.switchToPage()` pour écrire le numéro de page et
 * le pied de page.
 */

const NAVY = "#0B2545";
const EMERALD = "#0F9D58";
const RED = "#C0392B";
const ORANGE = "#E08E00";
const TEXT_DARK = "#1A1A1A";
const TEXT_MUTED = "#5A5A5A";
const BORDER = "#CCCCCC";
const HEADER_BG = "#E9EEF3";
const ROW_ALT = "#F7F7F7";

const FOOTER_NOTE_AIDE =
  "One Click BP — document généré automatiquement à partir des critères déclarés du dispositif. À confirmer auprès de l'organisme officiel.";

const STATUS_META = {
  eligible: { label: "ÉLIGIBLE", color: EMERALD },
  non_eligible: { label: "NON ÉLIGIBLE", color: RED },
  zone_grise: { label: "POTENTIELLEMENT ÉLIGIBLE", color: ORANGE },
};

const CRITERE_STATUT_LABEL = { ok: "Rempli", ko: "Non rempli", inconnu: "À vérifier" };

// ---------------------------------------------------------------------------
// Utilitaires (mêmes principes que bankPdf.js — dupliqués ici volontairement
// pour garder les deux générateurs indépendants et évitera un fichier
// utilitaire partagé hors du périmètre autorisé).
// ---------------------------------------------------------------------------
function pageBottom(doc) {
  return doc.page.height - doc.page.margins.bottom;
}
function ensureSpace(doc, h) {
  if (doc.y + h > pageBottom(doc)) doc.addPage();
}
function currentPageIndex(doc) {
  return doc.bufferedPageRange().count - 1;
}

function sectionHeaderRaw(doc, title, CW) {
  const x = doc.page.margins.left;
  doc.font("Helvetica-Bold").fontSize(14).fillColor(NAVY).text(title, x, doc.y, { width: CW });
  const ruleY = doc.y + 2;
  doc.moveTo(x, ruleY).lineTo(x + CW, ruleY).lineWidth(2).strokeColor(EMERALD).stroke();
  doc.y = ruleY + 10;
  doc.x = x;
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_DARK);
}

function startSection(doc, title, CW) {
  ensureSpace(doc, 70);
  doc.x = doc.page.margins.left;
  sectionHeaderRaw(doc, title, CW);
}

function subheading(doc, text, CW) {
  ensureSpace(doc, 20);
  const x = doc.page.margins.left;
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(NAVY).text(text, x, doc.y, { width: CW });
  doc.moveDown(0.25);
  doc.x = x;
  doc.font("Helvetica").fontSize(9.5).fillColor(TEXT_DARK);
}

function kv(doc, label, value, CW) {
  if (value === undefined || value === null || value === "") return;
  const str = typeof value === "boolean" ? (value ? "Oui" : "Non") : String(value);
  const full = `${label} : ${str}`;
  doc.font("Helvetica").fontSize(9.5);
  const h = doc.heightOfString(full, { width: CW });
  ensureSpace(doc, h + 4);
  const x = doc.page.margins.left;
  const y0 = doc.y;
  doc.font("Helvetica-Bold").fillColor(TEXT_DARK).text(`${label} : `, x, y0, { continued: true, width: CW });
  doc.font("Helvetica").fillColor("#333333").text(str);
  doc.moveDown(0.15);
  doc.x = x;
}

function paragraph(doc, text, CW, opts = {}) {
  if (!text) return;
  const size = opts.size || 9.5;
  doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(opts.color || TEXT_DARK);
  const h = doc.heightOfString(String(text), { width: CW });
  ensureSpace(doc, h + 4);
  const x = doc.page.margins.left;
  doc.text(String(text), x, doc.y, { width: CW, align: opts.align || "left" });
  doc.moveDown(opts.gap ?? 0.4);
  doc.x = x;
  doc.fillColor(TEXT_DARK).font("Helvetica").fontSize(9.5);
}

function bulletList(doc, items, CW, opts = {}) {
  const x = doc.page.margins.left;
  items.forEach((item) => {
    const w = CW - 14;
    doc.font("Helvetica").fontSize(9.5);
    const h = doc.heightOfString(String(item), { width: w });
    ensureSpace(doc, h + 8);
    const y0 = doc.y;
    doc.fillColor(opts.dotColor || EMERALD).circle(x + 3, y0 + 5, 1.8).fill();
    doc.fillColor(opts.color || TEXT_DARK).font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).text(String(item), x + 12, y0, { width: w });
    doc.moveDown(0.35);
    doc.x = x;
  });
}

function cellHeight(doc, text, width, fontSize = 9) {
  doc.font("Helvetica").fontSize(fontSize);
  return doc.heightOfString(String(text ?? ""), { width: Math.max(10, width - 8) });
}

function drawTable(doc, { x, colWidths, headers, rows, align = [], fontSize = 9, headerFontSize = 9.5, zebra = true, boldRows = [], rowColors = [] }) {
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  function drawHeaderRow() {
    ensureSpace(doc, 24);
    const y0 = doc.y;
    doc.rect(x, y0, tableWidth, 20).fill(HEADER_BG);
    let cx = x;
    doc.font("Helvetica-Bold").fontSize(headerFontSize).fillColor(NAVY);
    headers.forEach((h, i) => {
      doc.text(String(h), cx + 4, y0 + 5, { width: colWidths[i] - 8, align: align[i] || "left" });
      cx += colWidths[i];
    });
    doc.strokeColor(BORDER).lineWidth(0.6);
    doc.rect(x, y0, tableWidth, 20).stroke();
    doc.y = y0 + 20;
    doc.x = x;
  }

  drawHeaderRow();

  rows.forEach((row, ri) => {
    const heights = row.map((cell, i) => cellHeight(doc, cell, colWidths[i], fontSize));
    const rh = Math.max(16, ...heights.map((h) => h + 8));
    if (doc.y + rh > pageBottom(doc)) {
      doc.addPage();
      drawHeaderRow();
    }
    const y0 = doc.y;
    if (rowColors[ri]) {
      doc.rect(x, y0, tableWidth, rh).fill(rowColors[ri]);
    } else if (zebra && ri % 2 === 1) {
      doc.rect(x, y0, tableWidth, rh).fill(ROW_ALT);
    }
    const isBold = boldRows.includes(ri);
    doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize).fillColor(TEXT_DARK);
    let cx = x;
    row.forEach((cell, i) => {
      doc.text(String(cell ?? ""), cx + 4, y0 + 4, { width: colWidths[i] - 8, align: align[i] || "left" });
      cx += colWidths[i];
    });
    doc.strokeColor(BORDER).lineWidth(0.4);
    doc.rect(x, y0, tableWidth, rh).stroke();
    doc.y = y0 + rh;
    doc.x = x;
  });
  doc.moveDown(0.6);
  doc.x = x;
}

function finalizePages(doc, footerNote) {
  const total = doc.bufferedPageRange().count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    const isCover = i === 0;
    const footY = doc.page.height - 45;
    const leftX = doc.page.margins.left;
    const availW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.font("Helvetica").fontSize(7).fillColor(isCover ? "#9FB3D1" : "#8A8A8A");
    doc.text(footerNote, leftX, footY, { width: availW - 70, align: "left" });
    doc.text(`Page ${i + 1} / ${total}`, doc.page.width - doc.page.margins.right - 70, footY, { width: 70, align: "right" });
  }
}

// ---------------------------------------------------------------------------
// Couverture / Statut
// ---------------------------------------------------------------------------
function drawCover(doc, bp, formData, programme) {
  const { width, height } = doc.page;
  doc.rect(0, 0, width, height).fill(NAVY);
  doc.fillColor(EMERALD).rect(0, height * 0.46, width, 4).fill();

  try {
    doc.image(LOGO_WHITE_PATH, 50, 46, { width: 150 });
  } catch {
    doc.fillColor("#C7D6EC").font("Helvetica-Bold").fontSize(10).text("ONE CLICK BP", 50, 56);
  }

  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(20);
  doc.text("ANALYSE D'ÉLIGIBILITÉ", 50, height * 0.24, { width: width - 100 });
  doc.fontSize(16).text(programme.nomComplet || programme.nom, 50, doc.y + 4, { width: width - 100 });

  const nomProjet = formData?.projet?.nomProjet || bp.inputs.nomProjet || "Projet";
  doc.fillColor("#DCE6F5").font("Helvetica").fontSize(13).text(nomProjet, 50, height * 0.46 + 18, { width: width - 100 });

  const dateStr = new Date(bp.generatedAt || Date.now()).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
  doc.fillColor("#AFC3DD").font("Helvetica").fontSize(10.5);
  doc.text(`Document généré le ${dateStr}`, 50, height * 0.46 + 46);
  doc.text(`Source : ${programme.source || "Non précisée"}`, 50, doc.y + 4);
  doc.text(`Dernière mise à jour des critères : ${programme.derniereMiseAJour || "Non précisée"}`, 50, doc.y + 4);

  doc.fillColor("#93A9C9").font("Helvetica").fontSize(8.5).text(
    "Les critères d'éligibilité présentés dans ce document doivent être revérifiés auprès de la source officielle du dispositif avant toute démarche administrative, " +
      "les règles pouvant évoluer indépendamment de cet outil.",
    50, height - 100, { width: width - 100 }
  );
}

function drawStatutPage(doc, bp, formData, programme, CW) {
  startSection(doc, "Statut d'éligibilité", CW);
  const meta = STATUS_META[programme.statut] || STATUS_META.zone_grise;

  ensureSpace(doc, 60);
  const x = doc.page.margins.left;
  const badgeW = 260, badgeH = 40;
  doc.rect(x, doc.y, badgeW, badgeH).fill(meta.color);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(16).text(meta.label, x, doc.y + 12, { width: badgeW, align: "center" });
  doc.y += badgeH + 14;
  doc.x = x;

  kv(doc, "Dispositif", programme.nomComplet || programme.nom, CW);
  kv(doc, "Score de conformité aux critères", programme.score != null ? `${programme.score}%` : undefined, CW);
  doc.moveDown(0.2);
  subheading(doc, "Synthèse", CW);
  paragraph(doc, programme.resume, CW);
}

// ---------------------------------------------------------------------------
// Critères
// ---------------------------------------------------------------------------
function drawCriteresTable(doc, programme, CW, opts = {}) {
  const criteres = programme.criteres || [];
  const rowColors = criteres.map((c) => (c.status === "ko" ? "#FBEAEA" : c.status === "inconnu" ? "#FDF3E3" : undefined));
  drawTable(doc, {
    x: doc.page.margins.left,
    colWidths: [CW * 0.32, CW * 0.16, CW * 0.52],
    headers: opts.headers || ["Critère", "Statut", "Explication"],
    align: ["left", "left", "left"],
    rows: criteres.map((c) => [c.label, CRITERE_STATUT_LABEL[c.status] || c.status, c.explication || "-"]),
    rowColors,
    fontSize: 8.5,
  });
}

function drawCriteresSection(doc, bp, formData, programme, CW, title = "Critères analysés") {
  startSection(doc, title, CW);
  drawCriteresTable(doc, programme, CW);

  if (programme.statut === "non_eligible") {
    doc.moveDown(0.2);
    subheading(doc, "Motifs de non-éligibilité", CW);
    const kos = (programme.criteres || []).filter((c) => c.status === "ko");
    if (kos.length) {
      bulletList(doc, kos.map((c) => `${c.label} — ${c.explication}`), CW, { dotColor: RED, color: RED });
    } else {
      paragraph(doc, "Aucun critère bloquant identifié dans le détail, mais le statut global du dispositif est non éligible : se référer au tableau ci-dessus.", CW);
    }
  }
}

// ---------------------------------------------------------------------------
// Zone grise : structure imposée en 6 sections
// ---------------------------------------------------------------------------
function drawZoneGriseSections(doc, bp, formData, programme, CW) {
  startSection(doc, "1. Situation actuelle", CW);
  const inputs = bp.inputs || {};
  paragraph(
    doc,
    `Le projet "${formData?.projet?.nomProjet || inputs.nomProjet}" a été évalué au regard des critères du dispositif ${programme.nomComplet || programme.nom}. ` +
      `Situation financière déclarée : crédit bancaire souhaité de ${fmtDH(inputs.credit)}, apport personnel de ${fmtDH(inputs.apport)}, investissement total de ${fmtDH(inputs.investissements)}.`,
    CW
  );
  paragraph(doc, programme.resume, CW);

  startSection(doc, "2. Critères analysés", CW);
  drawCriteresTable(doc, programme, CW);

  startSection(doc, "3. Problèmes détectés", CW);
  const mesures = programme.mesuresCorrectives || [];
  if (mesures.length === 0) {
    paragraph(doc, "Aucun problème spécifique n'a été détecté au-delà des critères à vérifier listés ci-dessus.", CW);
  } else {
    bulletList(doc, mesures.map((m) => `${m.critere} (${CRITERE_STATUT_LABEL[m.statut] || m.statut}) — ${m.probleme}`), CW, { dotColor: ORANGE });
  }

  startSection(doc, "4. Mesures correctives", CW);
  if (mesures.length === 0) {
    paragraph(doc, "Aucune mesure corrective n'est nécessaire au-delà d'une confirmation des points à vérifier auprès de l'organisme.", CW);
  } else {
    bulletList(doc, mesures.map((m) => `${m.critere} — ${m.action}`), CW);
  }

  startSection(doc, "5. Recommandations", CW);
  const recs = mesures.map((m) => `Concernant "${m.critere}" : ${m.action}`);
  if (recs.length === 0) recs.push("Maintenir les paramètres actuels du dossier ; aucun point de vigilance supplémentaire identifié.");
  recs.push(`Revérifier l'ensemble des critères auprès de la source officielle (${programme.source}) avant tout dépôt de dossier.`);
  bulletList(doc, recs, CW);

  startSection(doc, "6. Étapes suivantes", CW);
  const etapes = mesures.map((m, i) => `${i + 1}. Traiter le point "${m.critere}" : ${m.action}`);
  etapes.push(`${etapes.length + 1}. Se rapprocher de l'organisme gestionnaire du dispositif (${programme.source}) pour confirmer officiellement l'éligibilité.`);
  bulletList(doc, etapes, CW);
}

// ---------------------------------------------------------------------------
// Éligible : clôture
// ---------------------------------------------------------------------------
function drawEligibleClosing(doc, bp, formData, programme, CW) {
  startSection(doc, "Prochaines étapes administratives", CW);
  const inputs = bp.inputs || {};
  subheading(doc, "Chiffres clés du projet pour ce dispositif", CW);
  kv(doc, "Crédit bancaire sollicité", fmtDH(inputs.credit), CW);
  kv(doc, "Apport personnel", fmtDH(inputs.apport), CW);
  kv(doc, "Investissement total", fmtDH(inputs.investissements), CW);
  doc.moveDown(0.2);

  const inconnus = (programme.criteres || []).filter((c) => c.status === "inconnu");
  subheading(doc, "Démarches à prévoir", CW);
  const etapes = [];
  if (inconnus.length) {
    inconnus.forEach((c) => etapes.push(`${c.label} : ${c.explication}`));
  }
  etapes.push(`Prendre contact avec l'organisme gestionnaire (${programme.source}) pour engager le dossier officiel.`);
  etapes.push("Préparer les pièces justificatives usuelles (identité, Registre du Commerce ou équivalent, plan de financement, devis d'investissement) demandées par l'organisme.");
  bulletList(doc, etapes, CW);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
export async function buildAidePdf(bp, formData, programme) {
  return await new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 70, left: 50, right: 50 },
        bufferPages: true,
        autoFirstPage: true,
      });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const CW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      drawCover(doc, bp, formData, programme);

      doc.addPage();
      drawStatutPage(doc, bp, formData, programme, CW);

      doc.addPage();
      if (programme.statut === "zone_grise") {
        drawZoneGriseSections(doc, bp, formData, programme, CW);
      } else {
        drawCriteresSection(doc, bp, formData, programme, CW, "Critères analysés");
        if (programme.statut === "eligible") {
          drawEligibleClosing(doc, bp, formData, programme, CW);
        }
      }

      finalizePages(doc, FOOTER_NOTE_AIDE);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
