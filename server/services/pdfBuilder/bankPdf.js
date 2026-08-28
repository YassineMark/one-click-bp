import PDFDocument from "pdfkit";
import { fmtDH } from "../../utils/i18n.js";
import { genererScenarios } from "../narrativeEngine.js";
import { WIZARD_STEPS } from "../../config/wizardSchema.js";

/**
 * Générateur du dossier PDF "Banque" (institution financière).
 * Toujours en français (destiné aux banques / organismes publics), quel que
 * soit `bp.langueBusinessPlan`.
 *
 * Pagination / Sommaire — note méthodologique :
 * pdfkit ne connaît pas le nombre total de pages tant que le document n'est
 * pas terminé. Plutôt que de faire un rendu en deux passes (ce qui doublerait
 * le travail de mise en page), ce fichier utilise `bufferPages: true` : tout
 * le contenu est rendu en UNE seule passe, en mémorisant simplement la page
 * courante à chaque début de section (via `doc.bufferedPageRange().count`).
 * Une fois le document entièrement construit, une passe finale légère
 * (`finalizePages`) revient sur la page de Sommaire et sur chaque page via
 * `doc.switchToPage()` pour y écrire les numéros de page réels et le pied de
 * page. Le rendu du contenu lui-même n'est donc fait qu'une fois ; seule
 * l'écriture des numéros est différée.
 */

// ---------------------------------------------------------------------------
// Constantes visuelles
// ---------------------------------------------------------------------------
const NAVY = "#0B2545";
const EMERALD = "#0F9D58";
const RED = "#C0392B";
const TEXT_DARK = "#1A1A1A";
const TEXT_MUTED = "#5A5A5A";
const BORDER = "#CCCCCC";
const HEADER_BG = "#E9EEF3";
const ROW_ALT = "#F7F7F7";

const FOOTER_NOTE_BANK =
  "One Click BP — document généré automatiquement. Simulation non contractuelle, hypothèses à valider avec un expert-comptable agréé.";

const INVEST_KEYS = [
  "local", "travaux", "equipement", "machines", "informatique", "mobilier",
  "vehicule", "logiciels", "licences", "stockInitial", "communication", "fraisCreation", "autres",
];

const SCN_LABELS = { prudent: "Prudent", realiste: "Réaliste", optimiste: "Optimiste" };

// ---------------------------------------------------------------------------
// Libellés réutilisés depuis le schéma du formulaire (évite toute divergence
// entre les libellés affichés au porteur de projet et ceux du PDF).
// ---------------------------------------------------------------------------
const FIELD_LABELS = {};
const ITEM_FIELD_LABELS = {};
for (const step of WIZARD_STEPS) {
  for (const f of step.fields) {
    FIELD_LABELS[f.path] = f.label;
    if (Array.isArray(f.itemFields)) {
      ITEM_FIELD_LABELS[f.path] = {};
      for (const sf of f.itemFields) ITEM_FIELD_LABELS[f.path][sf.path] = sf.label;
    }
  }
}

// ---------------------------------------------------------------------------
// Petits utilitaires
// ---------------------------------------------------------------------------
function pct(a, b) {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

function fmtRatio(v, unit) {
  if (v === null || v === undefined || Number.isNaN(v)) return "N/A";
  if (unit === "%") return `${v.toFixed(1)}%`;
  if (unit === "x") return `${v.toFixed(2)}x`;
  if (unit === "DH") return fmtDH(v);
  return String(Math.round(v));
}

function pageBottom(doc) {
  return doc.page.height - doc.page.margins.bottom;
}
function ensureSpace(doc, h) {
  if (doc.y + h > pageBottom(doc)) doc.addPage();
}
function currentPageNumber(doc) {
  return doc.bufferedPageRange().count;
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

function startSection(doc, toc, key, title, CW) {
  ensureSpace(doc, 70);
  doc.x = doc.page.margins.left;
  const entry = toc.find((e) => e.key === key);
  if (entry) entry.page = currentPageNumber(doc);
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

function bulletList(doc, items, CW) {
  const x = doc.page.margins.left;
  items.forEach((item) => {
    const w = CW - 14;
    doc.font("Helvetica").fontSize(9.5);
    const h = doc.heightOfString(String(item), { width: w });
    ensureSpace(doc, h + 8);
    const y0 = doc.y;
    doc.fillColor(EMERALD).circle(x + 3, y0 + 5, 1.8).fill();
    doc.fillColor(TEXT_DARK).font("Helvetica").fontSize(9.5).text(String(item), x + 12, y0, { width: w });
    doc.moveDown(0.35);
    doc.x = x;
  });
}

function cellHeight(doc, text, width, fontSize = 9) {
  doc.font("Helvetica").fontSize(fontSize);
  return doc.heightOfString(String(text ?? ""), { width: Math.max(10, width - 8) });
}

function drawTable(doc, { x, colWidths, headers, rows, align = [], fontSize = 9, headerFontSize = 9.5, zebra = true, boldRows = [] }) {
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
    if (zebra && ri % 2 === 1) {
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

// ---------------------------------------------------------------------------
// Graphiques vectoriels dessinés à la main (pdfkit n'a pas de moteur de
// graphiques intégré — ceci reflète réellement les données de `bp`).
// ---------------------------------------------------------------------------
function drawLineChart(doc, { x, y, width, height, labels, values, color = EMERALD, title }) {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const padLeft = 58, padRight = 10, padTop = title ? 18 : 6, padBottom = 22;
  const plotX = x + padLeft, plotY = y + padTop;
  const plotW = width - padLeft - padRight, plotH = height - padTop - padBottom;

  if (title) {
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(TEXT_DARK).text(title, x, y, { width });
  }

  doc.lineWidth(0.5).strokeColor("#B9B9B9");
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const gy = plotY + plotH - (i / steps) * plotH;
    doc.moveTo(plotX, gy).lineTo(plotX + plotW, gy).stroke();
    const val = min + (i / steps) * range;
    doc.font("Helvetica").fontSize(6.5).fillColor("#666666").text(fmtDH(val), x, gy - 4, { width: padLeft - 6, align: "right" });
  }

  if (min < 0 && max > 0) {
    const zy = plotY + plotH - ((0 - min) / range) * plotH;
    doc.strokeColor("#444444").lineWidth(1).moveTo(plotX, zy).lineTo(plotX + plotW, zy).stroke();
  }

  const stepX = plotW / Math.max(1, values.length - 1);
  doc.strokeColor(color).lineWidth(1.5);
  values.forEach((v, i) => {
    const px = plotX + i * stepX;
    const py = plotY + plotH - ((v - min) / range) * plotH;
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  });
  doc.stroke();

  values.forEach((v, i) => {
    const px = plotX + i * stepX;
    const py = plotY + plotH - ((v - min) / range) * plotH;
    doc.fillColor(color).circle(px, py, 1.6).fill();
  });

  doc.font("Helvetica").fontSize(6).fillColor("#444444");
  labels.forEach((lab, i) => {
    if (labels.length > 12 && i % 2 === 1) return;
    const px = plotX + i * stepX;
    doc.text(String(lab), px - 10, plotY + plotH + 4, { width: 20, align: "center" });
  });

  doc.strokeColor(BORDER).lineWidth(0.6).rect(plotX, plotY, plotW, plotH).stroke();
  doc.x = x;
  return y + height;
}

function drawGroupedBarChart(doc, { x, y, width, height, categories, series, title }) {
  const allVals = series.flatMap((s) => s.values);
  const min = Math.min(0, ...allVals), max = Math.max(0, ...allVals);
  const range = max - min || 1;
  const padLeft = 58, padRight = 10, padTop = title ? 18 : 8, padBottom = 40;
  const plotX = x + padLeft, plotY = y + padTop;
  const plotW = width - padLeft - padRight, plotH = height - padTop - padBottom;

  if (title) {
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(TEXT_DARK).text(title, x, y, { width });
  }

  doc.lineWidth(0.5).strokeColor("#B9B9B9");
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const gy = plotY + plotH - (i / steps) * plotH;
    doc.moveTo(plotX, gy).lineTo(plotX + plotW, gy).stroke();
    const val = min + (i / steps) * range;
    doc.font("Helvetica").fontSize(6.5).fillColor("#666666").text(fmtDH(val), x, gy - 4, { width: padLeft - 6, align: "right" });
  }

  const zeroY = plotY + plotH - ((0 - min) / range) * plotH;
  doc.strokeColor("#444444").lineWidth(1).moveTo(plotX, zeroY).lineTo(plotX + plotW, zeroY).stroke();

  const groupCount = categories.length;
  const groupW = plotW / groupCount;
  const gap = 6;
  const barW = Math.max(4, (groupW - gap * (series.length + 1)) / series.length);

  categories.forEach((cat, gi) => {
    const gx = plotX + gi * groupW;
    series.forEach((s, si) => {
      const v = s.values[gi];
      const barH = (Math.abs(v) / range) * plotH;
      const bx = gx + gap + si * (barW + gap);
      const by = v >= 0 ? zeroY - barH : zeroY;
      doc.fillColor(s.color || EMERALD).rect(bx, by, barW, Math.max(0.5, barH)).fill();
    });
    doc.font("Helvetica").fontSize(7.5).fillColor("#333333").text(cat, gx, plotY + plotH + 6, { width: groupW, align: "center" });
  });

  let lx = plotX;
  const ly = y + height - 12;
  series.forEach((s) => {
    doc.fillColor(s.color || EMERALD).rect(lx, ly, 8, 8).fill();
    doc.fillColor("#333333").font("Helvetica").fontSize(7.5).text(s.name, lx + 11, ly - 1);
    lx += doc.widthOfString(s.name) + 34;
  });

  doc.strokeColor(BORDER).lineWidth(0.6).rect(plotX, plotY, plotW, plotH).stroke();
  doc.x = x;
  return y + height;
}

// ---------------------------------------------------------------------------
// Couverture / Sommaire / Pied de page
// ---------------------------------------------------------------------------
function drawCover(doc, bp, formData) {
  const { width, height } = doc.page;
  doc.rect(0, 0, width, height).fill(NAVY);
  doc.fillColor(EMERALD).rect(0, height * 0.46, width, 4).fill();

  doc.fillColor("#C7D6EC").font("Helvetica-Bold").fontSize(10).text("ONE CLICK BP", 50, 56);

  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(24);
  doc.text("DOSSIER DE FINANCEMENT", 50, height * 0.26, { width: width - 100 });
  doc.text("BUSINESS PLAN", 50, doc.y + 2, { width: width - 100 });

  const nomProjet = formData?.projet?.nomProjet || bp.inputs.nomProjet || "Projet";
  doc.fillColor("#DCE6F5").font("Helvetica").fontSize(14).text(nomProjet, 50, height * 0.46 + 18, { width: width - 100 });

  const dateStr = new Date(bp.generatedAt || Date.now()).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
  doc.fillColor("#AFC3DD").font("Helvetica").fontSize(10.5);
  doc.text(`Document généré le ${dateStr}`, 50, height * 0.46 + 50);
  doc.text(`Porteur de projet : ${formData?.porteur?.nomComplet || "Non renseigné"}`, 50, doc.y + 4);

  doc.fillColor("#93A9C9").font("Helvetica").fontSize(8.5).text(
    "Ce document est une simulation générée automatiquement à partir des données déclarées par le porteur de projet. " +
      "Les hypothèses financières et fiscales présentées doivent impérativement être validées par un expert-comptable agréé avant toute décision d'engagement bancaire.",
    50, height - 110, { width: width - 100 }
  );
}

function drawTocPage(doc, entries, CW) {
  sectionHeaderRaw(doc, "Sommaire", CW);
  const x = doc.page.margins.left;
  const numColW = 34;
  entries.forEach((entry) => {
    ensureSpace(doc, 22);
    const y0 = doc.y;
    doc.font("Helvetica").fontSize(10).fillColor(TEXT_DARK);
    doc.text(entry.title, x, y0, { width: CW - numColW - 10 });
    entry.rowPage = currentPageIndex(doc);
    entry.rowY = y0;
    entry.rowX = x + CW - numColW;
    doc.y = Math.max(doc.y, y0 + 18);
    doc.x = x;
  });
}

function finalizePages(doc, tocEntries, footerNote) {
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
  for (const entry of tocEntries) {
    if (entry.rowPage == null || entry.page == null) continue;
    doc.switchToPage(entry.rowPage);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(TEXT_DARK);
    doc.text(String(entry.page), entry.rowX, entry.rowY, { width: 30, align: "right" });
  }
}

// ---------------------------------------------------------------------------
// Sections du dossier
// ---------------------------------------------------------------------------
function drawResume(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "resume", "Résumé exécutif", CW);
  const { inputs, cpc, pf } = bp;
  const nomProjet = formData?.projet?.nomProjet || inputs.nomProjet;
  paragraph(
    doc,
    `${nomProjet} est un projet ${bp.projectType === "nouvelle_activite" ? "de lancement d'une nouvelle activité au sein d'une entreprise existante" : "de création d'entreprise"} dans le secteur ${inputs.secteur}, implanté à ${inputs.ville}, sous la forme juridique ${inputs.formeJuridique}.`,
    CW
  );
  subheading(doc, "Chiffres clés", CW);
  kv(doc, "Investissement total", fmtDH(inputs.investissements), CW);
  kv(doc, "Apport personnel", `${fmtDH(inputs.apport)} (${pct(inputs.apport, inputs.investissements)}% de l'investissement)`, CW);
  kv(doc, "Crédit bancaire sollicité", `${fmtDH(inputs.credit)} sur ${inputs.dureeCredit} ans, taux indicatif ${inputs.tauxInteret}%`, CW);
  if (inputs.subventions > 0) kv(doc, "Subventions envisagées", fmtDH(inputs.subventions), CW);
  if (inputs.autresFinancements > 0) kv(doc, "Autres financements", fmtDH(inputs.autresFinancements), CW);
  kv(doc, "Chiffre d'affaires Année 1 → Année 3", `${fmtDH(cpc.ca[0])} → ${fmtDH(cpc.ca[2])}`, CW);
  kv(doc, "Résultat net Année 1 → Année 3", `${fmtDH(cpc.resultatNet[0])} → ${fmtDH(cpc.resultatNet[2])}`, CW);
  kv(doc, "Besoin de financement total (emplois)", fmtDH(pf.totalEmplois), CW);
  doc.moveDown(0.3);
  subheading(doc, "Objet de la demande", CW);
  paragraph(
    doc,
    `Le présent dossier sollicite un financement bancaire de ${fmtDH(inputs.credit)} destiné à couvrir une partie des besoins d'investissement et de fonds de roulement décrits dans le plan de financement ci-après.`,
    CW
  );
}

function drawPromoteur(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "promoteur", "Présentation du promoteur", CW);
  const p = formData?.porteur || {};
  kv(doc, FIELD_LABELS["porteur.nomComplet"], p.nomComplet, CW);
  kv(doc, FIELD_LABELS["porteur.situationActuelle"], p.situationActuelle, CW);
  kv(doc, FIELD_LABELS["porteur.formation"], p.formation, CW);
  kv(doc, FIELD_LABELS["porteur.domaineExpertise"], p.domaineExpertise, CW);
  kv(doc, FIELD_LABELS["porteur.experienceEntrepreneuriale"], p.experienceEntrepreneuriale, CW);
  kv(doc, FIELD_LABELS["porteur.nombreAssocies"], p.nombreAssocies, CW);
  kv(doc, FIELD_LABELS["porteur.roleEntreprise"], p.roleEntreprise, CW);
  kv(doc, FIELD_LABELS["porteur.apportPersonnelPrevu"], p.apportPersonnelPrevu != null ? fmtDH(p.apportPersonnelPrevu) : undefined, CW);
  doc.moveDown(0.2);
  if (p.experienceProfessionnelle) {
    subheading(doc, "Expérience professionnelle", CW);
    paragraph(doc, p.experienceProfessionnelle, CW);
  }
}

function drawEntreprise(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "entreprise", "Présentation de l'entreprise et du projet", CW);
  const pr = formData?.projet || {};
  kv(doc, FIELD_LABELS["projet.nomProjet"], pr.nomProjet, CW);
  kv(doc, FIELD_LABELS["projet.secteur"], pr.secteur, CW);
  kv(doc, FIELD_LABELS["projet.sousSecteur"], pr.sousSecteur, CW);
  kv(doc, FIELD_LABELS["projet.activitePrincipale"], pr.activitePrincipale, CW);
  kv(doc, FIELD_LABELS["projet.propositionValeur"], pr.propositionValeur, CW);
  doc.moveDown(0.2);
  if (pr.description) { subheading(doc, "Description du projet", CW); paragraph(doc, pr.description, CW); }
  if (pr.probleme) { subheading(doc, "Problème adressé", CW); paragraph(doc, pr.probleme, CW); }
  if (pr.solution) { subheading(doc, "Solution proposée", CW); paragraph(doc, pr.solution, CW); }
  const objectifs = [
    pr.objectifsCourtTerme && `Court terme (0-1 an) : ${pr.objectifsCourtTerme}`,
    pr.objectifsMoyenTerme && `Moyen terme (1-3 ans) : ${pr.objectifsMoyenTerme}`,
    pr.objectifsLongTerme && `Long terme (3-5 ans) : ${pr.objectifsLongTerme}`,
  ].filter(Boolean);
  if (objectifs.length) { subheading(doc, "Objectifs", CW); bulletList(doc, objectifs, CW); }

  const sj = formData?.structureJuridique || {};
  subheading(doc, "Structure juridique", CW);
  paragraph(
    doc,
    "Les informations suivantes sont fournies à titre indicatif et ne constituent pas un conseil juridique ; elles doivent être confirmées avec un notaire ou un conseil juridique agréé.",
    CW, { size: 8.5, color: TEXT_MUTED }
  );
  kv(doc, FIELD_LABELS["structureJuridique.formeJuridique"], sj.formeJuridique, CW);
  kv(doc, FIELD_LABELS["structureJuridique.capitalSocial"], sj.capitalSocial != null ? fmtDH(sj.capitalSocial) : undefined, CW);
  kv(doc, FIELD_LABELS["structureJuridique.nombreAssocies"], sj.nombreAssocies, CW);

  const loc = formData?.localisation || {};
  if (loc.ville || loc.typeLocal) {
    subheading(doc, "Implantation", CW);
    kv(doc, FIELD_LABELS["localisation.ville"], loc.ville, CW);
    kv(doc, FIELD_LABELS["localisation.typeLocal"], loc.typeLocal, CW);
    kv(doc, FIELD_LABELS["localisation.achatOuLocation"], loc.achatOuLocation, CW);
    kv(doc, FIELD_LABELS["localisation.surfaceM2"], loc.surfaceM2, CW);
    kv(doc, FIELD_LABELS["localisation.loyerEstime"], loc.loyerEstime != null ? fmtDH(loc.loyerEstime) : undefined, CW);
  }

  const produits = formData?.produits || [];
  if (produits.length) {
    doc.moveDown(0.2);
    subheading(doc, "Produits et services proposés", CW);
    doc.x = doc.page.margins.left;
    drawTable(doc, {
      x: doc.page.margins.left,
      colWidths: [CW * 0.34, CW * 0.18, CW * 0.18, CW * 0.3],
      headers: ["Produit / Service", "Prix de vente", "Coût direct", "Qté estimée / mois"],
      align: ["left", "right", "right", "right"],
      rows: produits.map((p) => [p.nom || "-", fmtDH(p.prixVente), fmtDH(p.coutDirect), String(p.quantiteEstimeeParMois ?? "-")]),
    });
  }
}

function drawMarche(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "marche", "Étude de marché", CW);
  const m = formData?.marche || {};
  kv(doc, FIELD_LABELS["marche.ville"], m.ville, CW);
  kv(doc, FIELD_LABELS["marche.region"], m.region, CW);
  kv(doc, FIELD_LABELS["marche.portee"], m.portee, CW);
  kv(doc, FIELD_LABELS["marche.clienteleCible"], m.clienteleCible, CW);
  kv(doc, FIELD_LABELS["marche.typeMarche"], m.typeMarche, CW);
  kv(doc, FIELD_LABELS["marche.tailleMarcheEstimee"], m.tailleMarcheEstimee != null ? fmtDH(m.tailleMarcheEstimee) : undefined, CW);
  kv(doc, FIELD_LABELS["marche.saisonnalite"], m.saisonnalite, CW);
  if (m.tendancesSecteur) { subheading(doc, "Tendances du secteur", CW); paragraph(doc, m.tendancesSecteur, CW); }
  if (m.facteursDemande) { subheading(doc, "Facteurs influençant la demande", CW); paragraph(doc, m.facteursDemande, CW); }
}

function drawConcurrence(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "concurrence", "Analyse concurrentielle", CW);
  const c = formData?.concurrence || {};
  if (!c.connaitConcurrents) {
    paragraph(
      doc,
      "Le porteur de projet déclare ne pas avoir identifié de concurrents directs à ce stade. Cette absence d'analyse concurrentielle formalisée constitue un point à approfondir avant la décision de financement.",
      CW
    );
  } else {
    const concurrents = c.concurrents || [];
    if (concurrents.length) {
      drawTable(doc, {
        x: doc.page.margins.left,
        colWidths: [CW * 0.22, CW * 0.2, CW * 0.29, CW * 0.29],
        headers: ["Nom", "Prix pratiqués", "Avantages", "Faiblesses"],
        rows: concurrents.map((x) => [x.nom || "-", x.prix || "-", x.avantages || "-", x.faiblesses || "-"]),
      });
    } else {
      paragraph(doc, "Le porteur de projet indique connaître des concurrents mais n'en a détaillé aucun.", CW);
    }
  }
  if (c.positionnementSouhaite) { subheading(doc, "Positionnement souhaité", CW); paragraph(doc, c.positionnementSouhaite, CW); }
  if (c.avantageConcurrentiel) { subheading(doc, "Avantage concurrentiel déclaré", CW); paragraph(doc, c.avantageConcurrentiel, CW); }
}

function drawStrategie(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "strategie", "Stratégie commerciale et marketing", CW);
  const cl = formData?.clients || {};
  kv(doc, FIELD_LABELS["clients.profilClient"], cl.profilClient, CW);
  kv(doc, FIELD_LABELS["clients.ageCible"], cl.ageCible, CW);
  kv(doc, FIELD_LABELS["clients.localisationClients"], cl.localisationClients, CW);
  kv(doc, FIELD_LABELS["clients.pouvoirAchat"], cl.pouvoirAchat, CW);
  kv(doc, FIELD_LABELS["clients.frequenceAchat"], cl.frequenceAchat, CW);
  kv(doc, FIELD_LABELS["clients.panierMoyen"], cl.panierMoyen != null ? fmtDH(cl.panierMoyen) : undefined, CW);
  kv(doc, FIELD_LABELS["clients.nombreClientsPrevu"], cl.nombreClientsPrevu, CW);
  kv(doc, FIELD_LABELS["clients.tauxCroissanceClients"], cl.tauxCroissanceClients != null ? `${cl.tauxCroissanceClients}%` : undefined, CW);
  if (cl.besoins) { subheading(doc, "Besoins des clients", CW); paragraph(doc, cl.besoins, CW); }
  if (cl.methodeAcquisition) { subheading(doc, "Méthode d'acquisition", CW); paragraph(doc, cl.methodeAcquisition, CW); }
  const co = formData?.concurrence || {};
  if (co.positionnementSouhaite || co.avantageConcurrentiel) {
    subheading(doc, "Positionnement", CW);
    if (co.positionnementSouhaite) paragraph(doc, co.positionnementSouhaite, CW);
    if (co.avantageConcurrentiel) paragraph(doc, co.avantageConcurrentiel, CW);
  }
}

function drawRH(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "rh", "Organisation et ressources humaines", CW);
  const rh = formData?.ressourcesHumaines || [];
  if (rh.length) {
    const labels = ITEM_FIELD_LABELS["ressourcesHumaines"] || {};
    drawTable(doc, {
      x: doc.page.margins.left,
      colWidths: [CW * 0.36, CW * 0.14, CW * 0.28, CW * 0.22],
      headers: [labels.poste || "Poste", labels.nombre || "Nombre", labels.salaireBrutMensuel || "Salaire brut mensuel", labels.dateEmbauchePrevue || "Date d'embauche"],
      align: ["left", "right", "right", "left"],
      rows: rh.map((p) => [p.poste || "-", String(p.nombre ?? 1), fmtDH(p.salaireBrutMensuel), p.dateEmbauchePrevue || "-"]),
    });
  } else {
    paragraph(doc, "Aucun poste détaillé n'a été renseigné dans le formulaire.", CW);
  }
  doc.moveDown(0.2);
  kv(doc, "Masse salariale annuelle totale (calculée)", fmtDH(bp.inputs.masseSal), CW);
  kv(doc, "Effectif total", String(bp.inputs.nbEmployes), CW);
  if (formData?.ressourcesHumaines_evolution) {
    subheading(doc, "Évolution prévue des effectifs", CW);
    paragraph(doc, formData.ressourcesHumaines_evolution, CW);
  }
}

function drawInvestissements(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "investissements", "Investissements", CW);
  const inv = formData?.investissement || {};
  const rows = INVEST_KEYS.map((k) => [FIELD_LABELS[`investissement.${k}`] || k, fmtDH(Number(inv[k]) || 0)]);
  rows.push(["TOTAL INVESTISSEMENT", fmtDH(bp.inputs.investissements)]);
  drawTable(doc, {
    x: doc.page.margins.left,
    colWidths: [CW * 0.68, CW * 0.32],
    headers: ["Poste", "Montant"],
    align: ["left", "right"],
    rows,
    boldRows: [rows.length - 1],
  });
}

function drawFinancement(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "financement", "Plan de financement", CW);
  const { pf } = bp;
  subheading(doc, "Emplois", CW);
  drawTable(doc, {
    x: doc.page.margins.left,
    colWidths: [CW * 0.68, CW * 0.32],
    headers: ["Emplois", "Montant"],
    align: ["left", "right"],
    rows: pf.emplois.map(([l, v]) => [l, fmtDH(v)]),
    boldRows: [pf.emplois.length - 1],
  });
  subheading(doc, "Ressources", CW);
  drawTable(doc, {
    x: doc.page.margins.left,
    colWidths: [CW * 0.68, CW * 0.32],
    headers: ["Ressources", "Montant"],
    align: ["left", "right"],
    rows: pf.ressources.map(([l, v]) => [l, fmtDH(v)]),
    boldRows: [pf.ressources.length - 1],
  });
  doc.moveDown(0.2);
  if (pf.ecart < 0) {
    paragraph(doc, `Écart de financement identifié : ${fmtDH(Math.abs(pf.ecart))} restent à couvrir pour équilibrer le plan de financement.`, CW, { bold: true, color: RED });
  } else {
    paragraph(doc, `Le plan de financement est équilibré, avec une trésorerie de démarrage disponible de ${fmtDH(pf.ecart)}.`, CW, { bold: true, color: EMERALD });
  }
}

function drawCPC(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "cpc", "Compte de résultat prévisionnel (3 ans)", CW);
  const { cpc } = bp;
  const boldRows = cpc.rows.map((r, i) => (/Résultat|Total/.test(r.label) ? i : -1)).filter((i) => i >= 0);
  drawTable(doc, {
    x: doc.page.margins.left,
    colWidths: [CW * 0.4, CW * 0.2, CW * 0.2, CW * 0.2],
    headers: ["Rubrique", ...cpc.annees],
    align: ["left", "right", "right", "right"],
    rows: cpc.rows.map((r) => [r.label.replace(/&amp;/g, "&"), fmtDH(r.vals[0]), fmtDH(r.vals[1]), fmtDH(r.vals[2])]),
    boldRows,
    fontSize: 8.5,
  });
}

function drawTreso(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "treso", "Plan de trésorerie", CW);
  drawTable(doc, {
    x: doc.page.margins.left,
    colWidths: [CW * 0.12, CW * 0.24, CW * 0.24, CW * 0.2, CW * 0.2],
    headers: ["Mois", "Encaissements", "Décaissements", "Flux net", "Solde cumulé"],
    align: ["left", "right", "right", "right", "right"],
    rows: bp.treso.map((m) => [m.mois, fmtDH(m.totEnc), fmtDH(m.totDec), fmtDH(m.fluxNet), fmtDH(m.soldeCumule)]),
    fontSize: 8.5,
  });
  doc.moveDown(0.4);
  ensureSpace(doc, 190);
  doc.x = doc.page.margins.left;
  const bottom = drawLineChart(doc, {
    x: doc.page.margins.left, y: doc.y, width: CW, height: 170,
    labels: bp.treso.map((m) => m.mois),
    values: bp.treso.map((m) => m.soldeCumule),
    color: EMERALD,
    title: "Évolution du solde de trésorerie cumulé (12 mois)",
  });
  doc.y = bottom + 10;
  doc.x = doc.page.margins.left;
}

function drawBilan(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "bilan", "Bilan prévisionnel", CW);
  paragraph(
    doc,
    "Ce bilan prévisionnel est une simulation simplifiée construite à partir des hypothèses du dossier ; il ne remplace pas un bilan comptable audité et doit être affiné avec un expert-comptable agréé.",
    CW, { size: 8.5, color: TEXT_MUTED }
  );
  const { bilan } = bp;
  subheading(doc, "Actif", CW);
  drawTable(doc, {
    x: doc.page.margins.left,
    colWidths: [CW * 0.4, CW * 0.2, CW * 0.2, CW * 0.2],
    headers: ["Actif", ...bilan.actif.annees],
    align: ["left", "right", "right", "right"],
    rows: bilan.actif.rows.map(([l, v]) => [l, fmtDH(v[0]), fmtDH(v[1]), fmtDH(v[2])]),
    boldRows: [bilan.actif.rows.length - 1],
  });
  subheading(doc, "Passif", CW);
  drawTable(doc, {
    x: doc.page.margins.left,
    colWidths: [CW * 0.4, CW * 0.2, CW * 0.2, CW * 0.2],
    headers: ["Passif", ...bilan.passif.annees],
    align: ["left", "right", "right", "right"],
    rows: bilan.passif.rows.map(([l, v]) => [l, fmtDH(v[0]), fmtDH(v[1]), fmtDH(v[2])]),
    boldRows: [bilan.passif.rows.length - 1],
  });
}

function drawBFR(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "bfr", "BFR, seuil de rentabilité et capacité de remboursement", CW);
  kv(doc, "Besoin en Fonds de Roulement estimé", fmtDH(bp.pf.bfrEstime), CW);
  doc.moveDown(0.2);
  subheading(doc, "Seuil de rentabilité (Année 1)", CW);
  if (bp.seuilRentabilite) {
    kv(doc, "Chiffre d'affaires seuil", fmtDH(bp.seuilRentabilite.seuilCA), CW);
    if (bp.seuilRentabilite.joursAtteinte) {
      kv(doc, "Atteint après", `${bp.seuilRentabilite.joursAtteinte} jours d'activité`, CW);
    } else {
      paragraph(doc, "Le seuil de rentabilité ne serait pas atteint au cours de la première année d'activité selon les hypothèses retenues.", CW);
    }
  } else {
    paragraph(doc, "Le seuil de rentabilité n'a pas pu être calculé avec les hypothèses actuelles (marge sur coûts variables nulle ou négative en Année 1).", CW);
  }
  doc.moveDown(0.2);
  subheading(doc, "Capacité de remboursement", CW);
  const capaRemb = bp.ratios.find((r) => r.label.startsWith("Capacité de Remboursement"));
  if (capaRemb) {
    drawTable(doc, {
      x: doc.page.margins.left,
      colWidths: [CW * 0.4, CW * 0.2, CW * 0.2, CW * 0.2],
      headers: [capaRemb.label, ...bp.cpc.annees],
      align: ["left", "right", "right", "right"],
      rows: [["Ratio (" + capaRemb.unit + ")", fmtRatio(capaRemb.vals[0], capaRemb.unit), fmtRatio(capaRemb.vals[1], capaRemb.unit), fmtRatio(capaRemb.vals[2], capaRemb.unit)]],
    });
    if (capaRemb.info) paragraph(doc, capaRemb.info, CW, { size: 8.5, color: TEXT_MUTED });
  }
}

function drawRatios(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "ratios", "Ratios financiers", CW);
  drawTable(doc, {
    x: doc.page.margins.left,
    colWidths: [CW * 0.46, CW * 0.18, CW * 0.18, CW * 0.18],
    headers: ["Ratio", ...bp.cpc.annees],
    align: ["left", "right", "right", "right"],
    rows: bp.ratios.map((r) => [r.label, fmtRatio(r.vals[0], r.unit), fmtRatio(r.vals[1], r.unit), fmtRatio(r.vals[2], r.unit)]),
    fontSize: 8.5,
  });
}

function drawRisques(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "risques", "Analyse des risques", CW);
  const av = bp.validation?.avertissements || [];
  if (av.length === 0) {
    paragraph(doc, "Aucun signal de risque n'a été détecté par les contrôles de cohérence automatiques. Ceci ne dispense pas d'une revue humaine approfondie du dossier par l'analyste crédit.", CW);
  } else {
    bulletList(doc, av.map((a) => a.message), CW);
  }
  const progs = bp.eligibilites?.programmes || [];
  const notable = progs.filter((p) => p.statut !== "eligible");
  if (notable.length) {
    doc.moveDown(0.2);
    subheading(doc, "Points de vigilance liés aux dispositifs d'aide", CW);
    bulletList(doc, notable.map((p) => `${p.nom} : ${p.resume}`), CW);
  }
}

function drawScenarios(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "scenarios", "Scénarios", CW);
  const scenarios = genererScenarios(bp.cpc);
  drawTable(doc, {
    x: doc.page.margins.left,
    colWidths: [CW * 0.25, CW * 0.25, CW * 0.25, CW * 0.25],
    headers: ["Scénario", "Chiffre d'affaires", "Résultat net", "Marge nette"],
    align: ["left", "right", "right", "right"],
    rows: scenarios.map((s) => [SCN_LABELS[s.id] || s.id, fmtDH(s.ca), fmtDH(s.rn), `${s.marge.toFixed(1)}%`]),
  });
  doc.moveDown(0.4);
  ensureSpace(doc, 190);
  doc.x = doc.page.margins.left;
  const bottom = drawGroupedBarChart(doc, {
    x: doc.page.margins.left, y: doc.y, width: CW, height: 170,
    categories: scenarios.map((s) => SCN_LABELS[s.id] || s.id),
    series: [
      { name: "Chiffre d'affaires", values: scenarios.map((s) => s.ca), color: NAVY },
      { name: "Résultat net", values: scenarios.map((s) => s.rn), color: EMERALD },
    ],
    title: "Comparaison des scénarios — CA et Résultat Net (Année 1)",
  });
  doc.y = bottom + 10;
  doc.x = doc.page.margins.left;
}

function buildRecommendations(bp) {
  const recs = [];
  const findRatio = (start) => bp.ratios.find((r) => r.label.startsWith(start));
  const margeNette = findRatio("Marge Nette");
  const autonomie = findRatio("Autonomie Financière");
  const capaRemb = findRatio("Capacité de Remboursement");
  const couvCharges = findRatio("Couverture des Charges");

  if (bp.pf.ecart < 0) recs.push(`Compléter le plan de financement : un écart de ${fmtDH(Math.abs(bp.pf.ecart))} reste à couvrir entre les emplois et les ressources identifiées.`);
  if (margeNette && margeNette.vals[0] < 5) recs.push(`Revoir la politique de prix ou les coûts directs : la marge nette Année 1 projetée (${margeNette.vals[0].toFixed(1)}%) est en-dessous du seuil de 5% généralement attendu pour une jeune PME.`);
  if (autonomie && autonomie.vals[0] < 30) recs.push(`Renforcer l'apport personnel ou les fonds propres : l'autonomie financière projetée (${autonomie.vals[0].toFixed(1)}%) est inférieure au seuil de 30-40% généralement apprécié par les prêteurs.`);
  if (capaRemb && capaRemb.vals[0] !== null && capaRemb.vals[0] < 1.2) recs.push(`Suivre de près la capacité de remboursement (${capaRemb.vals[0].toFixed(2)}x l'annuité moyenne en Année 1) : la marge de sécurité apparaît limitée.`);
  if (couvCharges && couvCharges.vals[0] !== null && couvCharges.vals[0] < 3) recs.push(`Vérifier la couverture des charges financières (${couvCharges.vals[0].toFixed(2)}x en Année 1), en-dessous du seuil de 3x généralement jugé rassurant par un prêteur.`);
  if (bp.validation.avertissements.length === 0 && recs.length === 0) {
    recs.push("Les principaux indicateurs financiers du dossier sont cohérents avec les seuils usuels des institutions de financement marocaines ; il est recommandé de maintenir ce niveau de rigueur lors du suivi opérationnel du projet.");
  }
  recs.push("Faire valider les hypothèses fiscales et sociales (IS/IR, CNSS/AMO, TVA) par un expert-comptable agréé avant la présentation officielle du dossier.");
  return recs;
}

function drawRecommandations(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "recommandations", "Recommandations", CW);
  bulletList(doc, buildRecommendations(bp), CW);
}

function drawImpact(doc, bp, formData, toc, CW) {
  startSection(doc, toc, "impact", "Analyse de l'entreprise existante et impact du lancement de la nouvelle activité", CW);
  const { balance } = bp;
  if (!balance.uploaded) {
    paragraph(doc, balance.impact.message, CW);
    return;
  }
  const a = balance.analysis || {};
  subheading(doc, "Analyse de la situation financière actuelle (Balance Générale importée)", CW);
  kv(doc, "Chiffre d'affaires historique", a.chiffreAffaires != null ? fmtDH(a.chiffreAffaires) : undefined, CW);
  kv(doc, "Résultat estimé", a.resultatEstime != null ? fmtDH(a.resultatEstime) : undefined, CW);
  kv(doc, "Trésorerie", a.tresorerie != null ? fmtDH(a.tresorerie) : undefined, CW);
  kv(doc, "Capitaux propres", a.capitauxPropres != null ? fmtDH(a.capitauxPropres) : undefined, CW);
  kv(doc, "Dettes", a.dettes != null ? fmtDH(a.dettes) : undefined, CW);
  if (a.endettementRatio !== undefined) kv(doc, "Ratio d'endettement actuel", `${Number(a.endettementRatio).toFixed(1)}%`, CW);
  doc.moveDown(0.3);
  subheading(doc, "Impact du lancement de la nouvelle activité", CW);
  const imp = balance.impact || {};
  if (imp.capaciteInvestissement !== undefined) kv(doc, "Capacité d'investissement estimée", fmtDH(imp.capaciteInvestissement), CW);
  if (imp.nouvelEndettementPct !== null && imp.nouvelEndettementPct !== undefined) kv(doc, "Endettement projeté après crédit", `${imp.nouvelEndettementPct}%`, CW);
  if (imp.impactTresorerie !== undefined) kv(doc, "Impact estimé sur la trésorerie", fmtDH(imp.impactTresorerie), CW);
  if (imp.poidsNouvelleActiviteCA !== null && imp.poidsNouvelleActiviteCA !== undefined) kv(doc, "Poids de la nouvelle activité dans le CA actuel", `${imp.poidsNouvelleActiviteCA}%`, CW);
  doc.moveDown(0.3);
  bulletList(doc, imp.observations || [], CW);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
export async function buildBankPdf(bp, formData) {
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

      const tocEntries = [
        { key: "resume", title: "Résumé exécutif" },
        { key: "promoteur", title: "Présentation du promoteur" },
        { key: "entreprise", title: "Présentation de l'entreprise et du projet" },
        { key: "marche", title: "Étude de marché" },
        { key: "concurrence", title: "Analyse concurrentielle" },
        { key: "strategie", title: "Stratégie commerciale et marketing" },
        { key: "rh", title: "Organisation et ressources humaines" },
        { key: "investissements", title: "Investissements" },
        { key: "financement", title: "Plan de financement" },
        { key: "cpc", title: "Compte de résultat prévisionnel (3 ans)" },
        { key: "treso", title: "Plan de trésorerie" },
        { key: "bilan", title: "Bilan prévisionnel" },
        { key: "bfr", title: "BFR, seuil de rentabilité et capacité de remboursement" },
        { key: "ratios", title: "Ratios financiers" },
        { key: "risques", title: "Analyse des risques" },
        { key: "scenarios", title: "Scénarios" },
        { key: "recommandations", title: "Recommandations" },
      ];
      if (bp.projectType === "nouvelle_activite") {
        tocEntries.push({ key: "impact", title: "Analyse de l'entreprise existante et impact du lancement de la nouvelle activité" });
      }

      drawCover(doc, bp, formData);

      doc.addPage();
      drawTocPage(doc, tocEntries, CW);

      doc.addPage();
      drawResume(doc, bp, formData, tocEntries, CW);
      drawPromoteur(doc, bp, formData, tocEntries, CW);
      drawEntreprise(doc, bp, formData, tocEntries, CW);
      drawMarche(doc, bp, formData, tocEntries, CW);
      drawConcurrence(doc, bp, formData, tocEntries, CW);
      drawStrategie(doc, bp, formData, tocEntries, CW);
      drawRH(doc, bp, formData, tocEntries, CW);
      drawInvestissements(doc, bp, formData, tocEntries, CW);
      drawFinancement(doc, bp, formData, tocEntries, CW);
      drawCPC(doc, bp, formData, tocEntries, CW);
      drawTreso(doc, bp, formData, tocEntries, CW);
      drawBilan(doc, bp, formData, tocEntries, CW);
      drawBFR(doc, bp, formData, tocEntries, CW);
      drawRatios(doc, bp, formData, tocEntries, CW);
      drawRisques(doc, bp, formData, tocEntries, CW);
      drawScenarios(doc, bp, formData, tocEntries, CW);
      drawRecommandations(doc, bp, formData, tocEntries, CW);
      if (bp.projectType === "nouvelle_activite") drawImpact(doc, bp, formData, tocEntries, CW);

      finalizePages(doc, tocEntries, FOOTER_NOTE_BANK);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

