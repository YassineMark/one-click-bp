import ExcelJS from "exceljs";
import { fmtDH } from "../../utils/i18n.js";
import { genererScenarios } from "../narrativeEngine.js";

/**
 * Générateur du dossier de financement bancaire (.xlsx).
 * Toujours en français, quel que soit `bp.langueBusinessPlan` : ce document
 * est destiné aux banques et institutions de financement marocaines.
 * Ton institutionnel, pas pédagogique — voir server/services/excelBuilder/entrepreneurWorkbook.js
 * pour l'équivalent grand public.
 */

const NAVY = "FF0B2545";
const NAVY2 = "FF13315C";
const EMERALD = "FF0F9D58";
const EMERALD2 = "FF0BC07A";
const WHITE = "FFFFFFFF";
const LIGHT = "FFF4F7FB";
const AMBER = "FFB7791F";

const CURRENCY_FMT = '#,##0" DH"';
const PCT_FMT = '0.0"%"';
const RATIO_FMT = '0.00"x"';
const DATE_STR = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

const FOOTER_TEXT = "Document généré automatiquement par One Click BP — hypothèses à valider avec un expert-comptable agréé. Simulation, non contractuelle.";

function safe(v, fallback = "Non renseigné") {
  if (v === null || v === undefined || v === "") return fallback;
  return v;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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

function titleRow(ws, text, span = 6) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  row.getCell(1).font = { bold: true, size: 18, color: { argb: EMERALD } };
  row.getCell(1).alignment = { vertical: "middle" };
  row.height = 30;
  for (let c = 1; c <= span; c++) {
    row.getCell(c).border = { bottom: { style: "medium", color: { argb: EMERALD2 } } };
  }
  return row;
}

function subtitleRow(ws, text, span = 6) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  row.getCell(1).font = { italic: true, size: 10, color: { argb: "FF555555" } };
  return row;
}

function sectionRow(ws, text, span = 6) {
  ws.addRow([]);
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  row.getCell(1).font = { bold: true, size: 12, color: { argb: NAVY } };
  row.getCell(1).border = { left: { style: "medium", color: { argb: EMERALD } } };
  row.height = 18;
  return row;
}

function styleHeaderRow(row, { align = "left" } = {}) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE }, size: 10.5 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: align, wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: EMERALD } } };
  });
  row.height = 24;
}

function styleTotalRow(row) {
  row.eachCell((cell) => {
    cell.font = { ...(cell.font || {}), bold: true };
    cell.border = { top: { style: "medium", color: { argb: NAVY } } };
  });
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
    row.alignment = { wrapText: true, vertical: "top" };
  }
}

function paragraphs(ws, texts, span = 6) {
  for (const t of texts) {
    const row = ws.addRow([t]);
    ws.mergeCells(row.number, 1, row.number, span);
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
    row.height = Math.max(18, Math.ceil(t.length / 110) * 15);
  }
}

function disclaimerBox(ws, text, span = 6) {
  ws.addRow([]);
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  const cell = row.getCell(1);
  cell.font = { italic: true, size: 9.5, color: { argb: AMBER } };
  cell.alignment = { wrapText: true, vertical: "top" };
  cell.border = { top: { style: "thin", color: { argb: AMBER } }, bottom: { style: "thin", color: { argb: AMBER } } };
  row.height = Math.max(30, Math.ceil(text.length / 100) * 15);
}

function findRatio(ratios, needle) {
  return ratios.find((r) => r.label.includes(needle));
}

function fmtRatioVal(v, unit) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "N/A";
  if (unit === "%") return v;
  if (unit === "DH") return Math.round(v);
  return v;
}

// ---------------------------------------------------------------------------
// 01 — Page de garde
// ---------------------------------------------------------------------------
function sheetPageDeGarde(wb, bp, formData) {
  const ws = newSheet(wb, "01 Page de garde", { widths: [34, 60] });
  ws.mergeCells("A1:B1");
  ws.getCell("A1").value = "DOSSIER DE FINANCEMENT";
  ws.getCell("A1").font = { bold: true, size: 22, color: { argb: WHITE } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("B1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  ws.getRow(1).height = 50;

  ws.mergeCells("A2:B2");
  ws.getCell("A2").value = safe(bp.inputs.nomProjet, "Projet");
  ws.getCell("A2").font = { bold: true, size: 16, color: { argb: WHITE } };
  ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMERALD } };
  ws.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("B2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMERALD } };
  ws.getRow(2).height = 32;

  ws.addRow([]);
  writeKV(ws, [
    ["Date d'édition du dossier", DATE_STR],
    ["Porteur de projet", safe(formData?.porteur?.nomComplet)],
    ["Secteur d'activité", safe(bp.inputs.secteur)],
    ["Ville d'implantation", safe(bp.inputs.ville)],
    ["Forme juridique envisagée", safe(bp.inputs.formeJuridique)],
    ["Investissement global", fmtDH(bp.inputs.investissements)],
    ["Financement bancaire sollicité", fmtDH(bp.inputs.credit)],
    ["Type de dossier", bp.projectType === "nouvelle_activite" ? "Nouvelle activité au sein d'une entreprise existante" : "Création d'entreprise"],
  ]);

  disclaimerBox(
    ws,
    "Ce document est produit automatiquement par l'outil de simulation One Click BP à partir des données déclarées par le porteur de projet. Il constitue une aide à la préparation du dossier de financement et ne remplace pas une étude réalisée par un expert-comptable agréé ou un conseiller bancaire. Toutes les hypothèses fiscales, sociales et financières présentées doivent être validées avant toute décision d'engagement.",
    2
  );
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 02 — Résumé exécutif
// ---------------------------------------------------------------------------
function sheetResumeExecutif(wb, bp, formData) {
  const ws = newSheet(wb, "02 Résumé exécutif", { widths: [40, 30] });
  titleRow(ws, "Résumé exécutif", 2);
  const { inputs, cpc, pf } = bp;
  const pctApport = inputs.investissements > 0 ? (inputs.apport / inputs.investissements) * 100 : 0;
  const pctCredit = inputs.investissements > 0 ? (inputs.credit / inputs.investissements) * 100 : 0;

  paragraphs(
    ws,
    [
      `${safe(inputs.nomProjet)} est un projet ${bp.projectType === "nouvelle_activite" ? "de développement d'une nouvelle activité au sein d'une entreprise existante" : "de création d'entreprise"} dans le secteur ${safe(inputs.secteur)}, implanté à ${safe(inputs.ville)}, sous la forme juridique ${safe(inputs.formeJuridique)}.`,
      `Le coût global du projet est estimé à ${fmtDH(inputs.investissements)}, financé à hauteur de ${pctApport.toFixed(0)}% par un apport personnel (${fmtDH(inputs.apport)}) et de ${pctCredit.toFixed(0)}% par un financement bancaire sollicité de ${fmtDH(inputs.credit)}, sur une durée de ${inputs.dureeCredit} an(s) à un taux indicatif de ${inputs.tauxInteret}%.`,
      `Le chiffre d'affaires prévisionnel progresse de ${fmtDH(cpc.ca[0])} en Année 1 à ${fmtDH(cpc.ca[2])} en Année 3 (croissance annuelle moyenne retenue : ${inputs.croissance}%), pour un résultat net prévisionnel de ${fmtDH(cpc.resultatNet[0])} en Année 1 et ${fmtDH(cpc.resultatNet[2])} en Année 3.`,
      pf.ecart >= 0
        ? `Le plan de financement prévisionnel est équilibré : les ressources mobilisées couvrent l'intégralité du besoin, avec une marge de sécurité de trésorerie de départ de ${fmtDH(Math.abs(pf.ecart))}.`
        : `Le plan de financement fait apparaître un besoin complémentaire de ${fmtDH(Math.abs(pf.ecart))} à couvrir (apport renforcé, financement additionnel ou révision du montant sollicité).`,
    ],
    2
  );

  sectionRow(ws, "Chiffres clés", 2);
  const head = ws.addRow(["Indicateur", "Valeur"]);
  styleHeaderRow(head);
  const rows = [
    ["Investissement total", fmtDH(inputs.investissements)],
    ["Apport personnel", fmtDH(inputs.apport)],
    ["Financement bancaire sollicité", fmtDH(inputs.credit)],
    ["Chiffre d'affaires Année 1", fmtDH(cpc.ca[0])],
    ["Chiffre d'affaires Année 3", fmtDH(cpc.ca[2])],
    ["Résultat net Année 1", fmtDH(cpc.resultatNet[0])],
    ["Résultat net Année 3", fmtDH(cpc.resultatNet[2])],
  ];
  rows.forEach((r, i) => stripeRow(ws.addRow(r), i));
  freezeAt(ws, head.number);
  return ws;
}

// ---------------------------------------------------------------------------
// 03 — Présentation du promoteur
// ---------------------------------------------------------------------------
function sheetPromoteur(wb, bp, formData) {
  const ws = newSheet(wb, "03 Présentation promoteur", { widths: [38, 62] });
  titleRow(ws, "Présentation du promoteur", 2);
  const p = formData?.porteur || {};
  const autresAssocies = Math.max(num(p.nombreAssocies, 1) - 1, 0);
  writeKV(ws, [
    ["Nom et prénom", safe(p.nomComplet)],
    ["Situation professionnelle actuelle", safe(p.situationActuelle)],
    ["Formation / diplôme", safe(p.formation)],
    ["Domaine d'expertise", safe(p.domaineExpertise)],
    ["Expérience professionnelle", safe(p.experienceProfessionnelle)],
    ["Expérience entrepreneuriale", safe(p.experienceEntrepreneuriale)],
    ["Rôle prévu dans l'entreprise", safe(p.roleEntreprise)],
    ["Nombre d'associés (porteur inclus)", num(p.nombreAssocies, 1)],
    ["Nombre d'autres associés", autresAssocies],
    ["Apport personnel prévu (déclaré à l'étape Profil)", p.apportPersonnelPrevu !== undefined && p.apportPersonnelPrevu !== null && p.apportPersonnelPrevu !== "" ? fmtDH(p.apportPersonnelPrevu) : "Non renseigné"],
  ]);
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 04 — Présentation de l'entreprise
// ---------------------------------------------------------------------------
function sheetEntreprise(wb, bp, formData) {
  const ws = newSheet(wb, "04 Présentation entreprise", { widths: [38, 62] });
  titleRow(ws, "Présentation de l'entreprise", 2);
  const pr = formData?.projet || {};
  const sj = formData?.structureJuridique || {};
  sectionRow(ws, "Identité du projet", 2);
  writeKV(ws, [
    ["Nom du projet / de l'entreprise", safe(pr.nomProjet)],
    ["Secteur d'activité", safe(pr.secteur)],
    ["Sous-secteur / spécialité", safe(pr.sousSecteur)],
    ["Activité principale", safe(pr.activitePrincipale)],
    ["Description détaillée", safe(pr.description)],
  ]);
  sectionRow(ws, "Structure juridique et fiscale", 2);
  writeKV(ws, [
    ["Forme juridique envisagée", safe(sj.formeJuridique)],
    ["Capital social envisagé", sj.capitalSocial !== undefined && sj.capitalSocial !== null && sj.capitalSocial !== "" ? fmtDH(sj.capitalSocial) : "Non renseigné"],
    ["Nombre d'associés", num(sj.nombreAssocies, 1)],
  ]);
  disclaimerBox(ws, "La forme juridique indiquée ci-dessus est une information déclarative à titre indicatif. Elle ne constitue pas un conseil juridique et doit être confirmée avec un notaire, un avocat d'affaires ou un centre régional d'investissement (CRI) avant immatriculation.", 2);
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 05 — Présentation du projet
// ---------------------------------------------------------------------------
function sheetProjet(wb, bp, formData) {
  const ws = newSheet(wb, "05 Présentation du projet", { widths: [38, 62] });
  titleRow(ws, "Présentation du projet", 2);
  const pr = formData?.projet || {};
  sectionRow(ws, "Problématique et solution", 2);
  writeKV(ws, [
    ["Problème adressé", safe(pr.probleme)],
    ["Solution proposée", safe(pr.solution)],
    ["Proposition de valeur", safe(pr.propositionValeur)],
  ]);
  sectionRow(ws, "Objectifs", 2);
  writeKV(ws, [
    ["Objectifs à court terme (0-1 an)", safe(pr.objectifsCourtTerme)],
    ["Objectifs à moyen terme (1-3 ans)", safe(pr.objectifsMoyenTerme)],
    ["Objectifs à long terme (3-5 ans)", safe(pr.objectifsLongTerme)],
  ]);
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 06 — Étude de marché
// ---------------------------------------------------------------------------
function sheetMarche(wb, bp, formData) {
  const ws = newSheet(wb, "06 Étude de marché", { widths: [38, 62] });
  titleRow(ws, "Étude de marché", 2);
  const m = formData?.marche || {};
  writeKV(ws, [
    ["Ville cible principale", safe(m.ville)],
    ["Région", safe(m.region)],
    ["Portée du marché", safe(m.portee)],
    ["Clientèle visée", safe(m.clienteleCible)],
    ["Type de marché", safe(m.typeMarche)],
    ["Taille estimée du marché adressable", m.tailleMarcheEstimee ? fmtDH(m.tailleMarcheEstimee) + "/an" : "Non renseignée"],
    ["Tendances observées dans le secteur", safe(m.tendancesSecteur)],
    ["Saisonnalité du secteur", safe(m.saisonnalite)],
    ["Principaux facteurs de la demande", safe(m.facteursDemande)],
  ]);
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 07 — Analyse concurrentielle
// ---------------------------------------------------------------------------
function sheetConcurrence(wb, bp, formData) {
  const ws = newSheet(wb, "07 Analyse concurrentielle", { widths: [22, 20, 32, 32] });
  titleRow(ws, "Analyse concurrentielle", 4);
  const c = formData?.concurrence || {};
  if (!c.connaitConcurrents) {
    ws.addRow([]);
    const row = ws.addRow(["Aucun concurrent direct n'a été formellement identifié par le porteur de projet à ce stade. Cette absence d'identification devra être approfondie avant le lancement de l'activité (étude terrain, benchmark sectoriel), mais aucun concurrent fictif n'est présenté dans ce dossier."]);
    ws.mergeCells(row.number, 1, row.number, 4);
    row.getCell(1).alignment = { wrapText: true };
    row.height = 40;
  } else {
    const head = ws.addRow(["Concurrent", "Prix pratiqués", "Avantages", "Faiblesses"]);
    styleHeaderRow(head);
    const concurrents = c.concurrents || [];
    if (concurrents.length === 0) {
      const row = ws.addRow(["Le porteur de projet a indiqué avoir identifié des concurrents mais aucune fiche détaillée n'a été renseignée.", "", "", ""]);
      ws.mergeCells(row.number, 1, row.number, 4);
    } else {
      concurrents.forEach((cc, i) => stripeRow(ws.addRow([safe(cc.nom), safe(cc.prix), safe(cc.avantages), safe(cc.faiblesses)]), i));
    }
    freezeAt(ws, head.number);
  }
  sectionRow(ws, "Positionnement", 4);
  writeKV2(ws, [
    ["Positionnement souhaité", safe(c.positionnementSouhaite)],
    ["Avantage concurrentiel revendiqué", safe(c.avantageConcurrentiel)],
  ], 4);
  return ws;
}

function writeKV2(ws, pairs, span) {
  for (const [label, value] of pairs) {
    const row = ws.addRow([label, value]);
    ws.mergeCells(row.number, 2, row.number, span);
    row.getCell(1).font = { bold: true, color: { argb: NAVY } };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    row.height = Math.max(18, Math.ceil(String(value).length / 60) * 15);
  }
}

// ---------------------------------------------------------------------------
// 08 — Stratégie commerciale et marketing
// ---------------------------------------------------------------------------
function sheetStrategie(wb, bp, formData) {
  const ws = newSheet(wb, "08 Stratégie commerciale", { widths: [38, 62] });
  titleRow(ws, "Stratégie commerciale et marketing", 2);
  const cl = formData?.clients || {};
  const co = formData?.concurrence || {};
  sectionRow(ws, "Cible clientèle", 2);
  writeKV(ws, [
    ["Profil type du client", safe(cl.profilClient)],
    ["Tranche d'âge cible", safe(cl.ageCible)],
    ["Localisation des clients", safe(cl.localisationClients)],
    ["Pouvoir d'achat de la cible", safe(cl.pouvoirAchat)],
    ["Principaux besoins", safe(cl.besoins)],
    ["Fréquence d'achat estimée", safe(cl.frequenceAchat)],
    ["Panier moyen estimé", cl.panierMoyen ? fmtDH(cl.panierMoyen) : "Non renseigné"],
    ["Nombre de clients prévu Année 1", cl.nombreClientsPrevu ?? "Non renseigné"],
    ["Croissance du nombre de clients (%/an)", cl.tauxCroissanceClients !== undefined && cl.tauxCroissanceClients !== null ? `${cl.tauxCroissanceClients}%` : "Non renseignée"],
    ["Méthode d'acquisition des clients", safe(cl.methodeAcquisition)],
  ]);
  sectionRow(ws, "Positionnement concurrentiel", 2);
  writeKV(ws, [
    ["Positionnement souhaité", safe(co.positionnementSouhaite)],
    ["Avantage concurrentiel", safe(co.avantageConcurrentiel)],
  ]);
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 09 — Organisation et ressources humaines
// ---------------------------------------------------------------------------
function sheetRH(wb, bp, formData) {
  const ws = newSheet(wb, "09 Organisation et RH", { widths: [30, 14, 20, 24, 20] });
  titleRow(ws, "Organisation et ressources humaines", 5);
  const rh = formData?.ressourcesHumaines || [];
  const head = ws.addRow(["Poste", "Effectif", "Salaire brut mensuel", "Date d'embauche prévue", "Coût annuel chargé (indicatif)"]);
  styleHeaderRow(head);
  const firstDataRow = head.number + 1;
  if (rh.length === 0) {
    const row = ws.addRow(["Aucun poste détaillé — masse salariale saisie globalement", "", "", "", ""]);
    ws.mergeCells(row.number, 1, row.number, 3);
  } else {
    rh.forEach((poste, i) => {
      const r = ws.addRow([safe(poste.poste), num(poste.nombre, 1), num(poste.salaireBrutMensuel)]);
      const rowNum = r.number;
      r.getCell(4).value = safe(poste.dateEmbauchePrevue);
      r.getCell(5).value = { formula: `B${rowNum}*C${rowNum}*12*1.2` };
      r.getCell(3).numFmt = CURRENCY_FMT;
      r.getCell(5).numFmt = CURRENCY_FMT;
      stripeRow(r, i);
    });
  }
  const lastDataRow = ws.lastRow.number;
  ws.addRow([]);
  const totalRow = ws.addRow(["TOTAL", { formula: rh.length ? `SUM(B${firstDataRow}:B${lastDataRow})` : "0" }, "", "", { formula: rh.length ? `SUM(E${firstDataRow}:E${lastDataRow})` : "0" }]);
  totalRow.getCell(3).value = "";
  totalRow.getCell(3).numFmt = CURRENCY_FMT;
  totalRow.getCell(5).numFmt = CURRENCY_FMT;
  styleTotalRow(totalRow);

  sectionRow(ws, "Synthèse (hypothèses retenues pour les calculs financiers)", 5);
  writeKV2(ws, [
    ["Masse salariale annuelle brute retenue", fmtDH(bp.inputs.masseSal)],
    ["Nombre d'employés retenu", bp.inputs.nbEmployes],
    ["Évolution prévue des effectifs sur 3 ans", safe(formData?.ressourcesHumaines_evolution)],
  ], 5);
  freezeAt(ws, head.number);
  return ws;
}

// ---------------------------------------------------------------------------
// 10 — Investissements
// ---------------------------------------------------------------------------
const INVEST_LABELS = {
  local: "Local (acquisition, pas de porte)",
  travaux: "Travaux / aménagement",
  equipement: "Équipement",
  machines: "Machines",
  informatique: "Matériel informatique",
  mobilier: "Mobilier",
  vehicule: "Véhicule",
  logiciels: "Logiciels",
  licences: "Licences / agréments",
  stockInitial: "Stock initial",
  communication: "Communication de lancement",
  fraisCreation: "Frais de création d'entreprise",
  autres: "Autres investissements",
};

function sheetInvestissements(wb, bp, formData) {
  const ws = newSheet(wb, "10 Investissements", { widths: [45, 22] });
  titleRow(ws, "Investissements", 2);
  const inv = formData?.investissement || {};
  const head = ws.addRow(["Poste d'investissement", "Montant"]);
  styleHeaderRow(head);
  const firstRow = head.number + 1;
  Object.entries(INVEST_LABELS).forEach(([key, label], i) => {
    const r = ws.addRow([label, num(inv[key])]);
    r.getCell(2).numFmt = CURRENCY_FMT;
    stripeRow(r, i);
  });
  const lastRow = ws.lastRow.number;
  const totalRow = ws.addRow(["TOTAL INVESTISSEMENT", { formula: `SUM(B${firstRow}:B${lastRow})` }]);
  totalRow.getCell(2).numFmt = CURRENCY_FMT;
  styleTotalRow(totalRow);
  freezeAt(ws, head.number);
  return ws;
}

// ---------------------------------------------------------------------------
// 11 — Plan de financement
// ---------------------------------------------------------------------------
function sheetPlanFinancement(wb, bp, formData) {
  const ws = newSheet(wb, "11 Plan de financement", { widths: [45, 22] });
  titleRow(ws, "Plan de financement initial", 2);
  const { pf } = bp;

  sectionRow(ws, "Emplois", 2);
  const headE = ws.addRow(["Emplois", "Montant"]);
  styleHeaderRow(headE);
  const firstE = headE.number + 1;
  pf.emplois.slice(0, -1).forEach((row, i) => {
    const r = ws.addRow(row);
    r.getCell(2).numFmt = CURRENCY_FMT;
    stripeRow(r, i);
  });
  const lastE = ws.lastRow.number;
  const totalE = ws.addRow(["TOTAL EMPLOIS", { formula: `SUM(B${firstE}:B${lastE})` }]);
  totalE.getCell(2).numFmt = CURRENCY_FMT;
  styleTotalRow(totalE);

  sectionRow(ws, "Ressources", 2);
  const headR = ws.addRow(["Ressources", "Montant"]);
  styleHeaderRow(headR);
  const firstR = headR.number + 1;
  pf.ressources.slice(0, -1).forEach((row, i) => {
    const r = ws.addRow(row);
    r.getCell(2).numFmt = CURRENCY_FMT;
    stripeRow(r, i);
  });
  const lastR = ws.lastRow.number;
  const sumFormula = pf.ecart >= 0 ? `SUM(B${firstR}:B${lastR - 1})` : `SUM(B${firstR}:B${lastR})`;
  const totalR = ws.addRow(["TOTAL RESSOURCES", { formula: sumFormula }]);
  totalR.getCell(2).numFmt = CURRENCY_FMT;
  styleTotalRow(totalR);

  sectionRow(ws, "Analyse de l'écart", 2);
  paragraphs(
    ws,
    [
      pf.ecart >= 0
        ? `Les ressources mobilisées excèdent le besoin total de ${fmtDH(Math.abs(pf.ecart))}, constituant une trésorerie de démarrage disponible. Le plan de financement est équilibré.`
        : `Un besoin de financement complémentaire de ${fmtDH(Math.abs(pf.ecart))} subsiste après mobilisation de l'apport, du crédit sollicité et des autres financements envisagés. Ce complément devra être couvert (apport renforcé, financement additionnel, ou révision du montant du projet) avant l'engagement du dossier.`,
      `Besoin en fonds de roulement de démarrage inclus dans les emplois : ${fmtDH(pf.bfrEstime)} (voir onglet dédié « Besoin en fonds de roulement »).`,
    ],
    2
  );
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 12 — Compte de résultat prévisionnel
// ---------------------------------------------------------------------------
const CPC_BOLD_LABELS = new Set(["Total Charges d'Exploitation", "Résultat d'Exploitation", "Résultat Courant Avant Impôt", "Résultat Net"]);

function sheetCPC(wb, bp) {
  const ws = newSheet(wb, "12 Compte de résultat", { orientation: "landscape", widths: [42, 20, 20, 20] });
  titleRow(ws, "Compte de résultat prévisionnel", 4);
  const { cpc } = bp;
  const head = ws.addRow(["Rubrique", ...cpc.annees]);
  styleHeaderRow(head, { align: "right" });
  head.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  cpc.rows.forEach((r, i) => {
    const row = ws.addRow([r.label, ...r.vals.map((v) => Math.round(v))]);
    row.getCell(2).numFmt = CURRENCY_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
    if (CPC_BOLD_LABELS.has(r.label)) styleTotalRow(row);
    else stripeRow(row, i);
  });
  const cafRow = ws.addRow(["Capacité d'Autofinancement (CAF)", ...cpc.capaciteAutofinancement.map((v) => Math.round(v))]);
  cafRow.getCell(2).numFmt = CURRENCY_FMT;
  cafRow.getCell(3).numFmt = CURRENCY_FMT;
  cafRow.getCell(4).numFmt = CURRENCY_FMT;
  styleTotalRow(cafRow);
  freezeAt(ws, head.number);
  return ws;
}

// ---------------------------------------------------------------------------
// 13 — Plan de trésorerie
// ---------------------------------------------------------------------------
function sheetTresorerie(wb, bp) {
  const ws = newSheet(wb, "13 Plan de trésorerie", { orientation: "landscape", widths: [36, ...Array(12).fill(11), 14] });
  titleRow(ws, "Plan de trésorerie mensuel (Année 1)", 14);
  const { treso } = bp;
  const mois = treso.map((t) => t.mois);
  const head = ws.addRow(["Rubrique", ...mois, "Total / Fin"]);
  styleHeaderRow(head, { align: "right" });
  head.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  const metrics = [
    { key: "encCA", label: "Encaissements CA (TTC)", agg: "sum" },
    { key: "encFin", label: "Encaissements financement", agg: "sum" },
    { key: "totEnc", label: "Total Encaissements", agg: "sum", bold: true },
    { key: "chgExt", label: "Décaissements charges externes", agg: "sum" },
    { key: "chgPers", label: "Décaissements charges de personnel", agg: "sum" },
    { key: "invest", label: "Décaissements investissement", agg: "sum" },
    { key: "tva", label: "TVA à décaisser", agg: "sum" },
    { key: "totDec", label: "Total Décaissements", agg: "sum", bold: true },
    { key: "fluxNet", label: "Flux Net de Trésorerie", agg: "sum", bold: true },
    { key: "soldeCumule", label: "Solde de Trésorerie Cumulé", agg: "last", bold: true },
  ];
  metrics.forEach((m, idx) => {
    const vals = treso.map((t) => Math.round(t[m.key]));
    const total = m.agg === "sum" ? vals.reduce((a, b) => a + b, 0) : vals[vals.length - 1];
    const row = ws.addRow([m.label, ...vals, total]);
    for (let c = 2; c <= 14; c++) row.getCell(c).numFmt = CURRENCY_FMT;
    if (m.bold) styleTotalRow(row);
    else stripeRow(row, idx);
  });
  freezeAt(ws, head.number);
  return ws;
}

// ---------------------------------------------------------------------------
// 14 — Bilan prévisionnel
// ---------------------------------------------------------------------------
function sheetBilan(wb, bp) {
  const ws = newSheet(wb, "14 Bilan prévisionnel", { orientation: "landscape", widths: [42, 20, 20, 20] });
  titleRow(ws, "Bilan prévisionnel", 4);
  const { bilan } = bp;

  sectionRow(ws, "Actif", 4);
  const headA = ws.addRow(["Rubrique", ...bilan.actif.annees]);
  styleHeaderRow(headA, { align: "right" });
  headA.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  bilan.actif.rows.forEach(([label, vals], i) => {
    const row = ws.addRow([label, ...vals.map((v) => Math.round(v))]);
    [2, 3, 4].forEach((c) => (row.getCell(c).numFmt = CURRENCY_FMT));
    if (label.startsWith("TOTAL")) styleTotalRow(row);
    else stripeRow(row, i);
  });

  sectionRow(ws, "Passif", 4);
  const headP = ws.addRow(["Rubrique", ...bilan.passif.annees]);
  styleHeaderRow(headP, { align: "right" });
  headP.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  const totalActifRowVals = bilan.actif.rows[bilan.actif.rows.length - 1][1];
  bilan.passif.rows.forEach(([label, vals], i) => {
    const row = ws.addRow([label, ...vals.map((v) => Math.round(v))]);
    [2, 3, 4].forEach((c) => (row.getCell(c).numFmt = CURRENCY_FMT));
    if (label.startsWith("TOTAL")) styleTotalRow(row);
    else stripeRow(row, i);
  });

  const totalPassifRowVals = bilan.passif.rows[bilan.passif.rows.length - 1][1];
  const ecartRow = ws.addRow(["Écart Actif − Passif (vérification d'équilibre)", ...totalActifRowVals.map((v, i) => Math.round(v - totalPassifRowVals[i]))]);
  [2, 3, 4].forEach((c) => (ecartRow.getCell(c).numFmt = CURRENCY_FMT));
  styleTotalRow(ecartRow);

  disclaimerBox(ws, "Ce bilan prévisionnel est une simulation simplifiée construite à partir des hypothèses du plan de financement et du compte de résultat. Il ne s'agit pas d'un bilan comptable audité : sa présentation officielle relève d'un expert-comptable agréé, notamment pour la ventilation détaillée de l'actif circulant et du passif circulant.", 4);
  freezeAt(ws, headA.number);
  return ws;
}

// ---------------------------------------------------------------------------
// 15 — Besoin en fonds de roulement
// ---------------------------------------------------------------------------
function sheetBFR(wb, bp) {
  const ws = newSheet(wb, "15 Besoin en fonds roul.", { widths: [45, 22] });
  titleRow(ws, "Besoin en fonds de roulement (BFR)", 2);
  const { pf, inputs } = bp;
  writeKV(ws, [
    ["Investissement total", fmtDH(inputs.investissements)],
    ["Taux forfaitaire retenu", "5% de l'investissement total"],
    ["BFR de démarrage estimé", fmtDH(pf.bfrEstime)],
  ]);
  paragraphs(
    ws,
    [
      `Le BFR de démarrage correspond à la trésorerie nécessaire pour financer le décalage entre les décaissements (achats, charges) et les encaissements (ventes) durant la phase de lancement, avant que le cycle d'exploitation ne s'autofinance. Il est estimé ici de façon forfaitaire à 5% de l'investissement total, soit ${fmtDH(pf.bfrEstime)}.`,
      `Ce montant est intégré aux emplois du plan de financement initial (voir onglet « Plan de financement »). Une analyse plus fine du BFR réel (délais clients : ${inputs.delaiClients} jours, délais fournisseurs : ${inputs.delaiFourn} jours, stock moyen : ${inputs.stockJours} jours) est recommandée une fois l'activité démarrée.`,
    ],
    2
  );
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 16 — Seuil de rentabilité
// ---------------------------------------------------------------------------
function sheetSeuilRentabilite(wb, bp) {
  const ws = newSheet(wb, "16 Seuil de rentabilité", { widths: [45, 22] });
  titleRow(ws, "Seuil de rentabilité (Année 1)", 2);
  const sr = bp.seuilRentabilite;
  if (!sr) {
    ws.addRow([]);
    const row = ws.addRow([
      "Le seuil de rentabilité n'a pas pu être calculé : la marge sur coûts variables de l'Année 1 (chiffre d'affaires diminué des achats et charges externes) est nulle ou négative. C'est un point de vigilance majeur qui doit être examiné avant la présentation du dossier — vérifiez les prix de vente, les coûts directs et les charges externes retenus.",
    ]);
    ws.mergeCells(row.number, 1, row.number, 2);
    row.getCell(1).alignment = { wrapText: true };
    row.height = 60;
  } else {
    writeKV(ws, [
      ["Chiffre d'affaires Année 1 (prévisionnel)", fmtDH(bp.cpc.ca[0])],
      ["Seuil de rentabilité (chiffre d'affaires critique)", fmtDH(sr.seuilCA)],
      ["Délai estimé pour atteindre le seuil", sr.joursAtteinte ? `${sr.joursAtteinte} jours` : "Non atteint au cours de l'Année 1"],
      ["Seuil atteint dans l'Année 1 ?", sr.atteintDansAnnee1 ? "Oui" : "Non"],
    ]);
    paragraphs(ws, [
      "Le seuil de rentabilité (ou point mort) est le chiffre d'affaires minimum à réaliser pour que l'entreprise ne réalise ni perte ni bénéfice, compte tenu de ses charges fixes et de sa structure de coûts variables retenues pour l'Année 1.",
    ], 2);
  }
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 17 — Capacité de remboursement
// ---------------------------------------------------------------------------
function sheetCapaciteRemboursement(wb, bp) {
  const ws = newSheet(wb, "17 Capacité remboursement", { widths: [42, 18, 18, 18] });
  titleRow(ws, "Capacité de remboursement", 4);
  const { cpc, inputs, ratios } = bp;
  const ratioCapa = findRatio(ratios, "Capacité de Remboursement");
  const annuiteMoy = inputs.credit > 0 && inputs.dureeCredit > 0 ? inputs.credit / Math.max(1, Math.min(3, inputs.dureeCredit)) : 0;

  writeKV2(ws, [
    ["Crédit bancaire sollicité", fmtDH(inputs.credit)],
    ["Durée du crédit", `${inputs.dureeCredit} an(s)`],
    ["Annuité moyenne de remboursement (approximation sur 3 ans)", inputs.credit > 0 ? fmtDH(annuiteMoy) : "N/A (aucun crédit sollicité)"],
  ], 4);

  sectionRow(ws, "Capacité d'autofinancement (CAF) et ratio de couverture", 4);
  const head = ws.addRow(["Indicateur", ...cpc.annees]);
  styleHeaderRow(head, { align: "right" });
  head.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  const cafRow = ws.addRow(["Capacité d'Autofinancement (CAF)", ...cpc.capaciteAutofinancement.map((v) => Math.round(v))]);
  [2, 3, 4].forEach((c) => (cafRow.getCell(c).numFmt = CURRENCY_FMT));

  const ratioRow = ws.addRow(["Capacité de Remboursement (CAF / annuité moy.)", ...(ratioCapa ? ratioCapa.vals.map((v) => (v === null ? "N/A" : v)) : cpc.capaciteAutofinancement.map(() => "N/A"))]);
  [2, 3, 4].forEach((c) => {
    if (typeof ratioRow.getCell(c).value === "number") ratioRow.getCell(c).numFmt = RATIO_FMT;
  });
  styleTotalRow(ratioRow);

  paragraphs(
    ws,
    [
      "La Capacité de Remboursement rapporte la CAF générée chaque année à l'annuité moyenne de remboursement du crédit sollicité. Un ratio supérieur à 1 signifie que la capacité d'autofinancement suffit à couvrir l'annuité ; un ratio inférieur à 1 signale un risque de tension sur le remboursement qui doit être anticipé (allongement de la durée, réduction du montant emprunté, renforcement de l'apport).",
    ],
    4
  );
  freezeAt(ws, head.number);
  return ws;
}

// ---------------------------------------------------------------------------
// 18 — Ratios financiers
// ---------------------------------------------------------------------------
function sheetRatios(wb, bp) {
  const ws = newSheet(wb, "18 Ratios financiers", { orientation: "landscape", widths: [46, 16, 16, 16, 46] });
  titleRow(ws, "Ratios financiers", 5);
  const { ratios, cpc } = bp;
  const head = ws.addRow(["Ratio", ...cpc.annees, "Repère indicatif"]);
  styleHeaderRow(head, { align: "right" });
  head.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  head.getCell(5).alignment = { horizontal: "left", vertical: "middle" };
  ratios.forEach((r, i) => {
    const vals = r.vals.map((v) => fmtRatioVal(v, r.unit));
    const row = ws.addRow([r.label, ...vals, r.info || ""]);
    [2, 3, 4].forEach((c) => {
      const cell = row.getCell(c);
      if (typeof cell.value !== "number") return;
      if (r.unit === "%") cell.numFmt = PCT_FMT;
      else if (r.unit === "DH") cell.numFmt = CURRENCY_FMT;
      else if (r.unit === "x") cell.numFmt = RATIO_FMT;
    });
    row.getCell(5).alignment = { wrapText: true };
    stripeRow(row, i);
  });
  freezeAt(ws, head.number);
  return ws;
}

// ---------------------------------------------------------------------------
// 19 — Analyse des risques
// ---------------------------------------------------------------------------
function sheetRisques(wb, bp) {
  const ws = newSheet(wb, "19 Analyse des risques", { widths: [26, 74] });
  titleRow(ws, "Analyse des risques", 2);
  const { validation, eligibilites, cpc } = bp;

  const niveauRisque = validation.erreurs.length > 0 || cpc.resultatNet[0] < 0 ? "Élevé" : validation.avertissements.length > 0 ? "Modéré" : "Faible";
  writeKV(ws, [["Niveau de risque global identifié (synthèse automatique)", niveauRisque]]);

  sectionRow(ws, "Points de vigilance financiers", 2);
  const head = ws.addRow(["Domaine", "Constat"]);
  styleHeaderRow(head);
  const points = [...validation.erreurs.map((e) => ({ champ: e.champ, message: e.message })), ...validation.avertissements.map((a) => ({ champ: a.champ, message: a.message }))];
  if (points.length === 0) {
    ws.addRow(["Aucun point bloquant", "Aucune anomalie ou point de vigilance particulier n'a été détecté par les contrôles automatiques de cohérence sur les données saisies."]);
  } else {
    points.forEach((p, i) => stripeRow(ws.addRow([p.champ, p.message]), i));
  }

  const programmesRisque = eligibilites.programmes.filter((p) => p.statut !== "eligible");
  if (programmesRisque.length > 0) {
    sectionRow(ws, "Points de vigilance liés à l'éligibilité aux dispositifs d'aide", 2);
    const head2 = ws.addRow(["Programme", "Constat"]);
    styleHeaderRow(head2);
    programmesRisque.forEach((p, i) => {
      stripeRow(ws.addRow([p.nom, p.resume]), i);
      p.criteres.filter((c) => c.status !== "ok").forEach((c, j) => stripeRow(ws.addRow([`↳ ${c.label}`, c.explication]), i + j + 1));
    });
  }
  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
// 20 — Scénarios
// ---------------------------------------------------------------------------
const SCENARIO_LABELS = { prudent: "Prudent", realiste: "Réaliste", optimiste: "Optimiste" };

function sheetScenarios(wb, bp) {
  const ws = newSheet(wb, "20 Scénarios", { widths: [22, 22, 22, 22] });
  titleRow(ws, "Scénarios (Année 1)", 4);
  const scenarios = genererScenarios(bp.cpc);
  const head = ws.addRow(["Scénario", "Chiffre d'affaires", "Résultat net", "Marge nette"]);
  styleHeaderRow(head);
  scenarios.forEach((s, i) => {
    const row = ws.addRow([SCENARIO_LABELS[s.id] || s.id, Math.round(s.ca), Math.round(s.rn), s.marge]);
    row.getCell(2).numFmt = CURRENCY_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = PCT_FMT;
    if (s.id === "realiste") styleTotalRow(row);
    else stripeRow(row, i);
  });
  paragraphs(
    ws,
    [
      "Le scénario Réaliste correspond aux hypothèses retenues dans l'ensemble du dossier. Le scénario Prudent simule un chiffre d'affaires inférieur de 20% et des charges plus élevées de 8% ; le scénario Optimiste simule un chiffre d'affaires supérieur de 20% et des charges allégées de 4%. Ces variantes permettent d'apprécier la sensibilité du projet aux aléas de démarrage.",
    ],
    4
  );
  freezeAt(ws, head.number);
  return ws;
}

// ---------------------------------------------------------------------------
// 21 — Recommandations
// ---------------------------------------------------------------------------
function sheetRecommandations(wb, bp) {
  const ws = newSheet(wb, "21 Recommandations", { widths: [26, 74] });
  titleRow(ws, "Recommandations", 2);
  const { validation, ratios, pf, cpc, inputs } = bp;
  const recos = [];

  for (const a of validation.avertissements) {
    if (a.champ === "financement") recos.push(["Financement", "Réexaminer le plan de financement afin de sécuriser la couverture du besoin identifié (renforcement de l'apport, financement complémentaire, ou ajustement du montant du projet)."]);
    else if (a.champ === "produits" || a.champ === "previsionsCommerciales") recos.push(["Prévisions commerciales", "Revoir les hypothèses de prix de vente, de volumes et de coûts directs afin de fiabiliser la marge brute prévisionnelle."]);
    else if (a.champ === "resultat") recos.push(["Rentabilité", "Justifier dans le dossier les raisons d'un résultat net Année 1 négatif (phase de lancement) et présenter le plan de retour à l'équilibre."]);
    else if (a.champ === "ressourcesHumaines") recos.push(["Ressources humaines", "Clarifier l'organisation du travail prévue (rémunération du porteur de projet, recrutements envisagés) pour lever toute ambiguïté vis-à-vis de l'analyste bancaire."]);
    else if (a.champ === "charges") recos.push(["Charges", "Détailler les charges de fonctionnement poste par poste plutôt que de s'appuyer sur une hypothèse sectorielle par défaut, pour renforcer la crédibilité du dossier."]);
  }

  const autonomie = findRatio(ratios, "Autonomie Financière");
  if (autonomie && autonomie.vals[0] < 30) recos.push(["Autonomie financière", `L'autonomie financière Année 1 (${autonomie.vals[0].toFixed(1)}%) est en-deçà du seuil généralement apprécié par les banques (${autonomie.info || ">30-40%"}). Un renforcement de l'apport personnel ou des fonds propres est recommandé.`]);

  const couverture = findRatio(ratios, "Couverture des Charges Financières");
  if (couverture && couverture.vals[0] !== null && couverture.vals[0] < 3) recos.push(["Couverture des charges financières", `Le ratio de couverture des charges financières Année 1 (${Number(couverture.vals[0]).toFixed(2)}x) est inférieur au repère usuel (${couverture.info || ">3x"}). Envisager un allongement de la durée du crédit ou une réduction du montant emprunté.`]);

  const capaRemb = findRatio(ratios, "Capacité de Remboursement");
  if (capaRemb && capaRemb.vals[0] !== null && capaRemb.vals[0] < 1) recos.push(["Capacité de remboursement", "La capacité d'autofinancement Année 1 est inférieure à l'annuité moyenne de remboursement : un différé de remboursement en début de prêt ou un allongement de la durée du crédit permettrait de sécuriser le service de la dette."]);

  if (pf.ecart < 0) recos.push(["Plan de financement", `Couvrir le besoin résiduel de ${fmtDH(Math.abs(pf.ecart))} avant le dépôt définitif du dossier.`]);
  if (cpc.resultatNet[0] < 0 && cpc.resultatNet[2] > 0) recos.push(["Trajectoire de rentabilité", "Le projet devient bénéficiaire en cours de période : mettre en avant cette trajectoire de redressement progressif dans la présentation orale du dossier au comité de crédit."]);

  if (recos.length === 0) {
    recos.push(["Synthèse", "Les indicateurs financiers et les contrôles de cohérence automatiques ne font apparaître aucun point de vigilance majeur. Le dossier peut être présenté en l'état, sous réserve de la validation des hypothèses par un expert-comptable agréé."]);
  }

  const head = ws.addRow(["Thème", "Recommandation"]);
  styleHeaderRow(head);
  recos.forEach((r, i) => {
    const row = ws.addRow(r);
    row.getCell(2).alignment = { wrapText: true };
    row.height = Math.max(18, Math.ceil(r[1].length / 90) * 15);
    stripeRow(row, i);
  });
  freezeAt(ws, head.number);
  return ws;
}

// ---------------------------------------------------------------------------
// 22 — Analyse de l'entreprise existante (nouvelle_activite uniquement)
// ---------------------------------------------------------------------------
function sheetEntrepriseExistante(wb, bp) {
  const ws = newSheet(wb, "22 Entreprise existante", { widths: [40, 30] });
  titleRow(ws, "Analyse de l'entreprise existante", 2);
  const { balance } = bp;

  if (!balance.uploaded) {
    ws.addRow([]);
    const row = ws.addRow([balance.impact.message]);
    ws.mergeCells(row.number, 1, row.number, 2);
    row.getCell(1).alignment = { wrapText: true };
    row.height = 50;
    freezeAt(ws, 0);
    return ws;
  }

  const a = balance.analysis;
  const impact = balance.impact;

  sectionRow(ws, "Soldes par classe comptable (Balance Générale importée)", 2);
  const head = ws.addRow(["Classe", "Solde"]);
  styleHeaderRow(head);
  Object.entries(a.soldesParClasse || {}).forEach(([classe, solde], i) => {
    const row = ws.addRow([`Classe ${classe} — ${(a.libellesClasses || {})[classe] || ""}`, Math.round(solde)]);
    row.getCell(2).numFmt = CURRENCY_FMT;
    stripeRow(row, i);
  });

  sectionRow(ws, "Indicateurs financiers extraits de la balance", 2);
  writeKV(ws, [
    ["Chiffre d'affaires (classe 7 — ventes)", fmtDH(a.chiffreAffaires)],
    ["Charges (classe 6)", fmtDH(a.charges)],
    ["Résultat estimé", fmtDH(a.resultatEstime)],
    ["Immobilisations nettes", fmtDH(a.immobilisations)],
    ["Trésorerie", fmtDH(a.tresorerie)],
    ["Dettes totales", fmtDH(a.dettes)],
    ["Créances clients", fmtDH(a.creances)],
    ["Capitaux propres", fmtDH(a.capitauxPropres)],
    ["Taux d'endettement (dettes / capitaux propres)", a.endettementRatio !== null && a.endettementRatio !== undefined ? `${a.endettementRatio}%` : "Non calculable"],
    ["Nombre de lignes comptables analysées", a.nombreLignes],
  ]);

  if (a.anomalies && a.anomalies.length > 0) {
    sectionRow(ws, "Anomalies détectées dans la balance importée", 2);
    a.anomalies.forEach((anomalie) => {
      const row = ws.addRow([anomalie]);
      ws.mergeCells(row.number, 1, row.number, 2);
      row.getCell(1).alignment = { wrapText: true };
      row.getCell(1).font = { color: { argb: AMBER } };
    });
  }

  sectionRow(ws, "Impact estimé de la nouvelle activité", 2);
  writeKV(ws, [
    ["Capacité d'investissement estimée de l'entreprise existante", fmtDH(impact.capaciteInvestissement)],
    ["Cette capacité paraît-elle suffisante pour le nouvel investissement ?", impact.capaciteInvestissementSuffisante ? "Oui" : "Non — financement externe complémentaire nécessaire"],
    ["Taux d'endettement projeté après le nouveau crédit", impact.nouvelEndettementPct !== null ? `${impact.nouvelEndettementPct}%` : "Non calculable"],
    ["Capacité d'endettement jugée acceptable (<150%) ?", impact.capaciteEndettementOk === null ? "Non calculable" : impact.capaciteEndettementOk ? "Oui" : "Non"],
    ["Impact estimé sur la trésorerie au démarrage", fmtDH(impact.impactTresorerie)],
    ["Risque de tension de trésorerie identifié ?", impact.risqueTresorerie ? "Oui" : "Non"],
    ["Poids du CA de la nouvelle activité / CA actuel", impact.poidsNouvelleActiviteCA !== null ? `${impact.poidsNouvelleActiviteCA}%` : "Non calculable"],
  ]);

  sectionRow(ws, "Observations", 2);
  (impact.observations || []).forEach((obs) => {
    const row = ws.addRow([obs]);
    ws.mergeCells(row.number, 1, row.number, 2);
    row.getCell(1).alignment = { wrapText: true };
    row.height = Math.max(18, Math.ceil(obs.length / 90) * 15);
  });

  freezeAt(ws, 0);
  return ws;
}

// ---------------------------------------------------------------------------
export async function buildBankWorkbook(bp, formData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "One Click BP";
  wb.created = new Date();
  wb.properties = { date1904: false };

  sheetPageDeGarde(wb, bp, formData);
  sheetResumeExecutif(wb, bp, formData);
  sheetPromoteur(wb, bp, formData);
  sheetEntreprise(wb, bp, formData);
  sheetProjet(wb, bp, formData);
  sheetMarche(wb, bp, formData);
  sheetConcurrence(wb, bp, formData);
  sheetStrategie(wb, bp, formData);
  sheetRH(wb, bp, formData);
  sheetInvestissements(wb, bp, formData);
  sheetPlanFinancement(wb, bp, formData);
  sheetCPC(wb, bp);
  sheetTresorerie(wb, bp);
  sheetBilan(wb, bp);
  sheetBFR(wb, bp);
  sheetSeuilRentabilite(wb, bp);
  sheetCapaciteRemboursement(wb, bp);
  sheetRatios(wb, bp);
  sheetRisques(wb, bp);
  sheetScenarios(wb, bp);
  sheetRecommandations(wb, bp);
  if (bp.projectType === "nouvelle_activite") sheetEntrepriseExistante(wb, bp);

  return wb;
}
