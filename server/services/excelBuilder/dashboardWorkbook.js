import ExcelJS from "exceljs";

/**
 * Génère le classeur Excel "Tableau de bord — Résumé exécutif" : un onglet
 * "Vue d'ensemble" (indicateurs globaux + graphiques non liés à une année
 * précise) puis un onglet par année (KPI + soldes intermédiaires de gestion
 * + graphique correspondant).
 *
 * Comme pour les autres classeurs (server/services/excelBuilder/*), ce
 * fichier ne recalcule RIEN : il met uniquement en forme les données déjà
 * calculées par analysisService.js (`bp`) et les images déjà rendues côté
 * client par Chart.js (`images`, capturées via chart.toBase64Image()).
 */

const NAVY = "FF0B2545";
const WHITE = "FFFFFFFF";
const EMERALD = "FF0F9D58";
const EMERALD2 = "FF0BC07A";
const LIGHT_FILL = "FFF4F7FB";
const WARN = "FFC0392B";

const CURRENCY_FMT = '#,##0" DH"';
const PCT_FMT = '0.0"%"';

const FOOTER = "One Click BP — tableau de bord généré automatiquement à partir de votre business plan.";

function styleTitleCell(cell) {
  cell.font = { bold: true, size: 18, color: { argb: EMERALD } };
}
function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: EMERALD } } };
  });
  row.height = 23;
}
function styleSectionRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: NAVY } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_FILL } };
  });
  row.getCell(1).border = { left: { style: "medium", color: { argb: EMERALD } } };
}

// Léger alternat de fond sur une plage de lignes déjà écrites (lisibilité
// des tableaux multi-lignes), sans toucher aux valeurs/formats déjà posés.
function zebraStripe(ws, firstRow, lastRow, numCols) {
  for (let r = firstRow; r <= lastRow; r++) {
    if ((r - firstRow) % 2 === 1) {
      const row = ws.getRow(r);
      for (let c = 1; c <= numCols; c++) {
        const cell = row.getCell(c);
        if (!cell.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_FILL } };
      }
    }
  }
}

function addSheet(wb, name) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.pageSetup = { fitToPage: true, fitToWidth: 1, orientation: "portrait" };
  ws.headerFooter = { oddFooter: `&C${FOOTER}    &P/&N` };
  return ws;
}

function addTitle(ws, text, span = 2) {
  ws.addRow([]);
  const row = ws.addRow([text]);
  row.height = 26;
  styleTitleCell(row.getCell(1));
  if (span > 1) ws.mergeCells(row.number, 1, row.number, span);
  for (let c = 1; c <= span; c++) {
    row.getCell(c).border = { bottom: { style: "medium", color: { argb: EMERALD2 } } };
  }
  ws.addRow([]);
  return row;
}

function addSectionLabel(ws, text, span = 2) {
  const row = ws.addRow([text]);
  styleSectionRow(row);
  if (span > 1) ws.mergeCells(row.number, 1, row.number, span);
  return row;
}

// Insère une image (déjà en base64 PNG) sous la position d'écriture
// courante, redimensionnée pour ne pas dépasser une largeur d'affichage
// raisonnable, en conservant ses proportions d'origine (celles du canvas
// Chart.js source).
function addChartImage(wb, ws, image, { maxWidth = 620 } = {}) {
  if (!image || !image.data || !image.width || !image.height) return;
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const imageId = wb.addImage({ base64: image.data, extension: "png" });
  const anchorRow = ws.rowCount + 1;
  ws.addImage(imageId, { tl: { col: 0.15, row: anchorRow - 1 + 0.15 }, ext: { width, height } });
  const rowsUsed = Math.ceil(height / 20) + 2;
  for (let i = 0; i < rowsUsed; i++) ws.addRow([]);
}

function kpiRows(ws, entries) {
  const headerRow = ws.addRow(["Indicateur", "Valeur"]);
  styleHeaderRow(headerRow);
  for (const [label, value, fmt] of entries) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    if (fmt) row.getCell(2).numFmt = fmt;
    if (typeof value === "number" && value < 0) row.getCell(2).font = { color: { argb: WARN }, bold: true };
  }
  ws.addRow([]);
}

// ---------------------------------------------------------------------------
// Onglet "Vue d'ensemble"
// ---------------------------------------------------------------------------
function buildVueEnsemble(wb, bp, images) {
  const ws = addSheet(wb, "Vue d'ensemble");
  ws.columns = [{ width: 34 }, { width: 20 }, { width: 20 }, { width: 20 }];

  addTitle(ws, "Tableau de bord — Résumé exécutif", 4);
  ws.addRow([`Projet : ${bp.inputs.nomProjet || "—"}`]).getCell(1).font = { italic: true };
  ws.addRow([]);

  addSectionLabel(ws, "Indicateurs globaux du projet", 2);
  kpiRows(ws, [
    ["Investissement total", bp.inputs.investissements, CURRENCY_FMT],
    ["Seuil de rentabilité (CA)", bp.seuilRentabilite ? bp.seuilRentabilite.seuilCA : "Non atteignable", bp.seuilRentabilite ? CURRENCY_FMT : undefined],
    ["Nombre d'employés", bp.inputs.nbEmployes, "#,##0"],
  ]);

  addSectionLabel(ws, "Synthèse par année", 6);
  const annees = bp.cpc.annees;
  const headerRow = ws.addRow(["Indicateur", ...annees]);
  styleHeaderRow(headerRow);
  const tresorerie = bp.bilan.actif.rows[2][1];
  const margeNette = bp.ratios[0].vals;
  const autonomieFin = bp.ratios[4].vals;
  const syntheseRows = [
    ["Chiffre d'affaires (HT)", bp.cpc.ca, CURRENCY_FMT],
    ["Résultat net", bp.cpc.resultatNet, CURRENCY_FMT],
    ["Marge nette", margeNette, PCT_FMT],
    ["Autonomie financière", autonomieFin, PCT_FMT],
    ["Trésorerie estimée", tresorerie, CURRENCY_FMT],
  ];
  for (const [label, vals, fmt] of syntheseRows) {
    const row = ws.addRow([label, ...vals]);
    row.getCell(1).font = { bold: true };
    for (let i = 0; i < vals.length; i++) {
      const cell = row.getCell(i + 2);
      cell.numFmt = fmt;
      if (vals[i] < 0) cell.font = { color: { argb: WARN }, bold: true };
    }
  }
  zebraStripe(ws, headerRow.number + 1, headerRow.number + syntheseRows.length, annees.length + 1);
  ws.addRow([]);

  addSectionLabel(ws, "Plan de financement", 4);
  addChartImage(wb, ws, images.financement);

  addSectionLabel(ws, "Chiffre d'affaires & résultat net (3 ans)", 4);
  addChartImage(wb, ws, images.caResultat);

  addSectionLabel(ws, "Trésorerie estimée (évolution 3 ans)", 4);
  addChartImage(wb, ws, images.tresorerie);

  addSectionLabel(ws, "Indicateurs de rentabilité (évolution 3 ans)", 4);
  addChartImage(wb, ws, images.ratios);
}

// ---------------------------------------------------------------------------
// Onglets "Année N"
// ---------------------------------------------------------------------------
function buildAnneeSheet(wb, bp, images, yearIndex) {
  const label = bp.cpc.annees[yearIndex];
  const ws = addSheet(wb, label);
  ws.columns = [{ width: 34 }, { width: 20 }];

  addTitle(ws, `Résultats détaillés — ${label}`, 2);

  addSectionLabel(ws, "Indicateurs clés", 2);
  const tresorerie = bp.bilan.actif.rows[2][1][yearIndex];
  const margeNette = bp.ratios[0].vals[yearIndex];
  const autonomieFin = bp.ratios[4].vals[yearIndex];
  kpiRows(ws, [
    ["Chiffre d'affaires (HT)", bp.cpc.ca[yearIndex], CURRENCY_FMT],
    ["Résultat net", bp.cpc.resultatNet[yearIndex], CURRENCY_FMT],
    ["Marge nette", margeNette, PCT_FMT],
    ["Autonomie financière", autonomieFin, PCT_FMT],
    ["Trésorerie estimée", tresorerie, CURRENCY_FMT],
  ]);

  addSectionLabel(ws, "Soldes intermédiaires de gestion (SIG)", 2);
  const sigRows = bp.sig.filter((r) => r.bold);
  const headerRow = ws.addRow(["Solde", "Montant"]);
  styleHeaderRow(headerRow);
  for (const r of sigRows) {
    const row = ws.addRow([r.label.replace(/^=\s*/, ""), r.vals[yearIndex]]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).numFmt = CURRENCY_FMT;
    if (r.vals[yearIndex] < 0) row.getCell(2).font = { color: { argb: WARN }, bold: true };
  }
  zebraStripe(ws, headerRow.number + 1, headerRow.number + sigRows.length, 2);
  ws.addRow([]);

  addSectionLabel(ws, `Soldes intermédiaires de gestion — ${label}`, 2);
  const sigImage = Array.isArray(images.sig) ? images.sig[yearIndex] : null;
  addChartImage(wb, ws, sigImage);
}

export async function construireDashboardWorkbook(bp, images = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "One Click BP";
  wb.created = new Date();

  buildVueEnsemble(wb, bp, images);
  for (let i = 0; i < bp.cpc.annees.length; i++) buildAnneeSheet(wb, bp, images, i);

  return wb.xlsx.writeBuffer();
}
