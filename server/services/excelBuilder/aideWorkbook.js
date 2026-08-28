import ExcelJS from "exceljs";
import { fmtDH } from "../../utils/i18n.js";

/**
 * Générateur du dossier personnalisé pour un dispositif d'aide/financement
 * public (INTELAKA, FORSA...). Toujours en français. Ce générateur ne fait
 * que mettre en forme les critères déjà évalués par
 * server/services/eligibilityEngine.js + server/config/aidesMaroc.js — il
 * n'invente et ne recalcule aucune règle d'éligibilité.
 */

const NAVY = "FF0B2545";
const EMERALD = "FF0F9D58";
const WHITE = "FFFFFFFF";
const LIGHT = "FFF3F5F8";
const AMBER = "FFB45309";

const CURRENCY_FMT = '#,##0" DH"';
const DATE_STR = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

const FOOTER_TEXT = "Document généré automatiquement par One Click BP — hypothèses à valider avec un expert-comptable agréé. Simulation, non contractuelle.";

function safe(v, fallback = "Non renseigné") {
  if (v === null || v === undefined || v === "") return fallback;
  return v;
}

function addFooter(ws) {
  ws.headerFooter.oddFooter = `&L${FOOTER_TEXT}&R Page &P / &N`;
  ws.headerFooter.evenFooter = `&L${FOOTER_TEXT}&R Page &P / &N`;
}

function newSheet(wb, name, { orientation = "portrait", widths = [] } = {}) {
  const ws = wb.addWorksheet(name, {
    pageSetup: { orientation, fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.2 } },
  });
  if (widths.length) ws.columns = widths.map((w) => ({ width: w }));
  addFooter(ws);
  return ws;
}

function freezeAt(ws, rowNumber) {
  ws.views = [{ state: "frozen", ySplit: rowNumber }];
}

function titleRow(ws, text, span = 2) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  row.getCell(1).font = { bold: true, size: 16, color: { argb: EMERALD } };
  row.getCell(1).alignment = { vertical: "middle" };
  row.height = 28;
  return row;
}

function sectionRow(ws, text, span = 2) {
  ws.addRow([]);
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  row.getCell(1).font = { bold: true, size: 12, color: { argb: NAVY } };
  row.height = 18;
  return row;
}

function styleHeaderRow(row, { align = "left" } = {}) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE }, size: 10.5 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: align, wrapText: true };
  });
  row.height = 24;
}

function stripeRow(row, i) {
  if (i % 2 === 1) {
    row.eachCell((cell) => {
      if (!cell.fill || !cell.fill.fgColor) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
    });
  }
}

function writeKV(ws, pairs) {
  for (const [label, value] of pairs) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, color: { argb: NAVY } };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    row.height = Math.max(18, Math.ceil(String(value).length / 70) * 15);
  }
}

function paragraphs(ws, texts, span = 2) {
  for (const t of texts) {
    const row = ws.addRow([t]);
    ws.mergeCells(row.number, 1, row.number, span);
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
    row.height = Math.max(18, Math.ceil(t.length / 110) * 15);
  }
}

function disclaimerBox(ws, text, span = 2) {
  ws.addRow([]);
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  const cell = row.getCell(1);
  cell.font = { italic: true, size: 9.5, color: { argb: AMBER } };
  cell.alignment = { wrapText: true, vertical: "top" };
  cell.border = { top: { style: "thin", color: { argb: AMBER } }, bottom: { style: "thin", color: { argb: AMBER } } };
  row.height = Math.max(30, Math.ceil(text.length / 100) * 15);
}

const STATUS_LABEL = { ok: "Rempli", ko: "Non rempli", inconnu: "À vérifier" };
const STATUT_PROGRAMME_LABEL = { eligible: "Éligible", non_eligible: "Non éligible", zone_grise: "Éligibilité à confirmer" };

// ---------------------------------------------------------------------------
// 01 — Situation actuelle
// ---------------------------------------------------------------------------
function sheetSituation(wb, bp, formData, programme) {
  const ws = newSheet(wb, "01 Situation actuelle", { widths: [38, 62] });
  titleRow(ws, `Dossier ${programme.nom}`);
  const { inputs } = bp;
  writeKV(ws, [
    ["Date d'édition du dossier", DATE_STR],
    ["Projet", safe(inputs.nomProjet)],
    ["Porteur de projet", safe(formData?.porteur?.nomComplet)],
    ["Secteur d'activité", safe(inputs.secteur)],
    ["Ville d'implantation", safe(inputs.ville)],
    ["Type de dossier", bp.projectType === "nouvelle_activite" ? "Nouvelle activité au sein d'une entreprise existante" : "Création d'entreprise"],
  ]);
  sectionRow(ws, "Dispositif concerné");
  writeKV(ws, [
    ["Programme", safe(programme.nomComplet, programme.nom)],
    ["Source officielle", safe(programme.source)],
    ["Dernière mise à jour des critères (base One Click BP)", safe(programme.derniereMiseAJour)],
    ["Statut d'éligibilité estimé", STATUT_PROGRAMME_LABEL[programme.statut] || programme.statut],
    ["Score de conformité aux critères connus", `${programme.score}%`],
  ]);
  disclaimerBox(
    ws,
    `Les critères d'éligibilité aux dispositifs publics d'aide à l'entrepreneuriat évoluent régulièrement. Ce dossier reflète l'état des règles connues de ${safe(programme.source)} à la date du ${safe(programme.derniereMiseAJour)} : il est impératif de revérifier ces critères auprès de la source officielle avant tout dépôt de dossier.`
  );
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 02 — Critères analysés
// ---------------------------------------------------------------------------
function sheetCriteres(wb, programme) {
  const ws = newSheet(wb, "02 Critères analysés", { widths: [42, 18, 60] });
  titleRow(ws, "Critères analysés", 3);
  const head = ws.addRow(["Critère", "Statut", "Explication"]);
  styleHeaderRow(head);
  (programme.criteres || []).forEach((c, i) => {
    const row = ws.addRow([c.label, STATUS_LABEL[c.status] || c.status, c.explication]);
    row.getCell(2).font = { bold: true, color: { argb: c.status === "ok" ? EMERALD : c.status === "ko" ? "FFB00020" : AMBER } };
    row.getCell(3).alignment = { wrapText: true };
    row.height = Math.max(18, Math.ceil(String(c.explication || "").length / 70) * 15);
    stripeRow(row, i);
  });
  freezeAt(ws, head.number);
  return ws;
}

// ---------------------------------------------------------------------------
// 03a — Résumé d'éligibilité (statut eligible)
// ---------------------------------------------------------------------------
function sheetResumeEligibilite(wb, bp, programme) {
  const ws = newSheet(wb, "03 Résumé d'éligibilité", { widths: [38, 62] });
  titleRow(ws, "Résumé d'éligibilité");
  paragraphs(ws, [programme.resume]);
  sectionRow(ws, "Chiffres clés du projet pertinents pour ce dispositif");
  const { inputs } = bp;
  writeKV(ws, [
    ["Investissement total du projet", fmtDH(inputs.investissements)],
    ["Apport personnel", fmtDH(inputs.apport)],
    ["Crédit bancaire / financement sollicité", fmtDH(inputs.credit)],
  ]);
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 03b/04/05/06 — Zone grise : Problèmes / Mesures / Recommandations / Étapes
// ---------------------------------------------------------------------------
function sheetProblemes(wb, programme) {
  const ws = newSheet(wb, "03 Problèmes détectés", { widths: [30, 70] });
  titleRow(ws, "Problèmes détectés", 2);
  const head = ws.addRow(["Critère", "Problème identifié"]);
  styleHeaderRow(head);
  const mesures = programme.mesuresCorrectives || [];
  if (mesures.length === 0) {
    ws.addRow(["Aucun problème bloquant identifié", "Tous les critères connus sont remplis ; seule une vérification administrative reste à finaliser."]);
  } else {
    mesures.forEach((m, i) => {
      const row = ws.addRow([m.critere, m.probleme]);
      row.getCell(2).alignment = { wrapText: true };
      row.height = Math.max(18, Math.ceil(String(m.probleme || "").length / 80) * 15);
      stripeRow(row, i);
    });
  }
  freezeAt(ws, head.number);
  return ws;
}

function sheetMesures(wb, programme) {
  const ws = newSheet(wb, "04 Mesures correctives", { widths: [30, 70] });
  titleRow(ws, "Mesures correctives", 2);
  const head = ws.addRow(["Critère", "Action recommandée"]);
  styleHeaderRow(head);
  const mesures = programme.mesuresCorrectives || [];
  if (mesures.length === 0) {
    ws.addRow(["—", "Aucune mesure corrective nécessaire au vu des critères connus."]);
  } else {
    mesures.forEach((m, i) => {
      const row = ws.addRow([m.critere, m.action]);
      row.getCell(2).alignment = { wrapText: true };
      row.height = Math.max(18, Math.ceil(String(m.action || "").length / 80) * 15);
      stripeRow(row, i);
    });
  }
  freezeAt(ws, head.number);
  return ws;
}

function sheetRecommandations(wb, programme) {
  const ws = newSheet(wb, "05 Recommandations", { widths: [90] });
  titleRow(ws, "Recommandations", 1);
  const mesures = programme.mesuresCorrectives || [];
  const koCount = mesures.filter((m) => m.statut === "ko").length;
  const inconnuCount = mesures.filter((m) => m.statut === "inconnu").length;

  const texts = [programme.resume];
  if (koCount > 0) {
    texts.push(`${koCount} critère(s) actuellement bloquant(s) doivent être corrigés avant de pouvoir confirmer l'éligibilité à ${programme.nom} : voir l'onglet « Mesures correctives » pour le détail des ajustements à apporter (montants, structure du financement).`);
  }
  if (inconnuCount > 0) {
    texts.push(`${inconnuCount} critère(s) nécessitent une vérification ou une démarche administrative complémentaire (non déductible des seules données financières saisies dans ce dossier) : voir l'onglet « Étapes suivantes ».`);
  }
  texts.push(`Une fois les points ci-dessus levés, il est recommandé de reprendre contact avec la source officielle du dispositif (${programme.source}) pour une confirmation formelle avant dépôt du dossier.`);

  paragraphs(ws, texts, 1);
  freezeAt(ws, 0);
  return ws;
}

function sheetEtapesSuivantes(wb, programme) {
  const ws = newSheet(wb, "06 Étapes suivantes", { widths: [30, 70] });
  titleRow(ws, "Étapes suivantes", 2);
  const head = ws.addRow(["Critère concerné", "Étape concrète à réaliser"]);
  styleHeaderRow(head);
  const mesures = programme.mesuresCorrectives || [];
  if (mesures.length === 0) {
    ws.addRow(["—", `Contacter ${programme.source} pour finaliser la démarche de dépôt du dossier.`]);
  } else {
    mesures.forEach((m, i) => {
      const etape =
        m.statut === "ko"
          ? `Ajuster le montant ou la structure du financement concerné par « ${m.critere} », puis relancer l'analyse d'éligibilité.`
          : `Effectuer la vérification ou démarche administrative liée à « ${m.critere} » auprès de ${programme.source} avant dépôt du dossier.`;
      const row = ws.addRow([m.critere, etape]);
      row.getCell(2).alignment = { wrapText: true };
      row.height = Math.max(18, Math.ceil(etape.length / 80) * 15);
      stripeRow(row, i);
    });
  }
  freezeAt(ws, head.number);
  return ws;
}

// ---------------------------------------------------------------------------
export async function buildAideWorkbook(bp, formData, programme) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "One Click BP";
  wb.created = new Date();
  wb.properties = { date1904: false };

  sheetSituation(wb, bp, formData, programme);
  sheetCriteres(wb, programme);

  if (programme.statut === "eligible") {
    sheetResumeEligibilite(wb, bp, programme);
  } else if (programme.statut === "zone_grise") {
    sheetProblemes(wb, programme);
    sheetMesures(wb, programme);
    sheetRecommandations(wb, programme);
    sheetEtapesSuivantes(wb, programme);
  } else {
    // Défensif : ce générateur n'est normalement appelé que pour eligible/zone_grise.
    sheetResumeEligibilite(wb, bp, programme);
  }

  return wb;
}
