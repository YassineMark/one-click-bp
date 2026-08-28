import ExcelJS from "exceljs";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

/**
 * Lecture et analyse de la Balance Générale (plan comptable marocain CGNC).
 * Formats acceptés : CSV, XLSX, PDF (texte). Aucune donnée n'est inventée :
 * si l'extraction échoue ou ne trouve pas de lignes exploitables, la fonction
 * renvoie un statut d'échec explicite plutôt qu'un résultat approximatif.
 */

function toNumber(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return raw;
  const s = String(raw).trim().replace(/\s/g, "").replace(/[^\d,.\-]/g, "");
  if (!s) return 0;
  // Gère "1 234,56" (virgule décimale) et "1,234.56" (point décimal)
  let normalized = s;
  if (s.includes(",") && s.includes(".")) {
    normalized = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    normalized = s.replace(",", ".");
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function isAccountCode(token) {
  return /^\d{3,8}[A-Za-z]?$/.test(String(token || "").trim());
}

/**
 * Normalise un tableau de lignes brutes (tableaux de cellules) en
 * {compte, libelle, debit, credit}. Détecte automatiquement la disposition
 * des colonnes à partir de l'en-tête si présent, sinon retombe sur une
 * heuristique positionnelle (comme dans la version précédente de l'outil).
 */
function normalizeTable(rawRows) {
  const rows = rawRows.filter((r) => r && r.some((c) => String(c ?? "").trim() !== ""));
  if (rows.length === 0) return { rows: [], detected: null };

  let headerIdx = -1;
  let colMap = null;
  for (let i = 0; i < Math.min(rows.length, 3); i++) {
    const lower = rows[i].map((c) => String(c ?? "").toLowerCase().trim());
    const findCol = (...needles) => lower.findIndex((c) => needles.some((n) => c.includes(n)));
    const compteIdx = findCol("compte", "n°compte", "n° compte", "code");
    const libelleIdx = findCol("intitulé", "intitule", "libellé", "libelle");
    const soldeDebIdx = findCol("solde débiteur", "solde debiteur");
    const soldeCredIdx = findCol("solde créditeur", "solde crediteur");
    const debitIdx = findCol("débit", "debit");
    const creditIdx = findCol("crédit", "credit");
    if (compteIdx >= 0 && (soldeDebIdx >= 0 || debitIdx >= 0)) {
      headerIdx = i;
      colMap = { compteIdx, libelleIdx, debitIdx: soldeDebIdx >= 0 ? soldeDebIdx : debitIdx, creditIdx: soldeCredIdx >= 0 ? soldeCredIdx : creditIdx, usesSolde: soldeDebIdx >= 0 };
      break;
    }
  }

  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;
  const out = [];
  for (const r of dataRows) {
    const compte = colMap ? r[colMap.compteIdx] : r[0];
    if (!isAccountCode(compte)) continue; // ignore lignes de total / vides / en-têtes résiduelles
    const libelle = colMap && colMap.libelleIdx >= 0 ? String(r[colMap.libelleIdx] ?? "") : String(r[1] ?? "");
    const debit = colMap ? toNumber(r[colMap.debitIdx]) : toNumber(r[2]);
    const credit = colMap ? toNumber(r[colMap.creditIdx]) : toNumber(r[3]);
    out.push({ compte: String(compte).trim(), libelle: libelle.trim(), debit, credit });
  }
  return { rows: out, detected: colMap ? "en-tête détecté" : "position par défaut (compte;libellé;débit;crédit)" };
}

function splitCSVLine(line, sep) {
  return line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
}

export function parseCSVBuffer(buffer) {
  const text = buffer.toString("utf-8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], detected: null };
  const sep = lines[0].includes(";") ? ";" : ",";
  const rawRows = lines.map((l) => splitCSVLine(l, sep));
  return normalizeTable(rawRows);
}

export async function parseXLSXBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], detected: null };
  const rawRows = [];
  sheet.eachRow((row) => {
    const values = row.values.slice(1).map((v) => (v && typeof v === "object" && "result" in v ? v.result : v));
    rawRows.push(values);
  });
  return normalizeTable(rawRows);
}

export async function parsePDFBuffer(buffer) {
  const data = await pdfParse(buffer);
  const lines = data.text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rawRows = lines.map((line) => {
    // Colonnes séparées par 2+ espaces (mise en page tabulaire habituelle des PDF exportés)
    const parts = line.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts;
    return line.split(/\s+/); // fallback : un seul espace
  });
  return normalizeTable(rawRows);
}

export async function parseBalanceFile(buffer, mimeType, originalFilename) {
  const ext = (originalFilename.split(".").pop() || "").toLowerCase();
  try {
    let result;
    if (ext === "csv" || mimeType.includes("csv")) result = parseCSVBuffer(buffer);
    else if (ext === "xlsx" || ext === "xls" || mimeType.includes("spreadsheet") || mimeType.includes("excel")) result = await parseXLSXBuffer(buffer);
    else if (ext === "pdf" || mimeType.includes("pdf")) result = await parsePDFBuffer(buffer);
    else return { ok: false, error: "Format de fichier non pris en charge. Formats acceptés : CSV, XLSX, PDF." };

    if (!result.rows || result.rows.length === 0) {
      return { ok: false, error: "Aucune ligne comptable exploitable n'a pu être extraite de ce fichier. Vérifiez qu'il s'agit bien d'une balance générale (colonnes Compte / Intitulé / Débit / Crédit)." };
    }
    return { ok: true, rows: result.rows, detection: result.detected };
  } catch (err) {
    return { ok: false, error: `Échec de lecture du fichier : ${err.message}` };
  }
}

const LIBELLES_CLASSES = {
  1: "Financement Permanent (capital, réserves, dettes de financement)",
  2: "Actif Immobilisé",
  3: "Actif Circulant (hors trésorerie)",
  4: "Passif Circulant (hors trésorerie)",
  5: "Trésorerie",
  6: "Charges",
  7: "Produits",
};

export function analyserBalance(rows) {
  const soldesParClasse = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  let totalDebit = 0;
  let totalCredit = 0;
  const comptesCles = { ventes: 0, achats: 0, clients: 0, fournisseurs: 0, emprunts: 0, capital: 0, tresorerieActif: 0, immobilisations: 0, amortissements: 0, salaires: 0 };

  for (const r of rows) {
    const classe = String(r.compte).trim()[0];
    const solde = r.debit - r.credit;
    totalDebit += r.debit;
    totalCredit += r.credit;
    if (soldesParClasse.hasOwnProperty(classe)) soldesParClasse[classe] += solde;

    const c = String(r.compte).trim();
    if (c.startsWith("71")) comptesCles.ventes += -solde;
    if (c.startsWith("61")) comptesCles.achats += solde;
    if (c.startsWith("342")) comptesCles.clients += solde;
    if (c.startsWith("441")) comptesCles.fournisseurs += -solde;
    if (c.startsWith("13")) comptesCles.emprunts += -solde;
    if (c.startsWith("111")) comptesCles.capital += -solde;
    if (c.startsWith("51")) comptesCles.tresorerieActif += solde;
    if (/^2[0-3]/.test(c)) comptesCles.immobilisations += solde;
    if (/^28/.test(c)) comptesCles.amortissements += -solde;
    if (c.startsWith("617")) comptesCles.salaires += solde;
  }

  for (const k of Object.keys(soldesParClasse)) soldesParClasse[k] = Math.round(soldesParClasse[k] * 100) / 100;

  const capitauxPropres = soldesParClasse[1] > 0 ? 0 : Math.abs(soldesParClasse[1]) - comptesCles.emprunts; // approx : financement permanent - dettes long terme
  const chiffreAffaires = Math.round(comptesCles.ventes);
  const totalCharges = Math.round(comptesCles.achats + Math.abs(Math.min(0, 0))); // charges classe 6 déjà agrégées ci-dessous
  const chargesClasse6 = Math.round(soldesParClasse[6]);
  const produitsClasse7 = Math.round(-soldesParClasse[7]);
  const resultatEstime = Math.round(produitsClasse7 - chargesClasse6);
  const dettesTotal = Math.round(comptesCles.emprunts + comptesCles.fournisseurs);
  const creancesTotal = Math.round(comptesCles.clients);
  const tresorerie = Math.round(soldesParClasse[5]);
  const immobilisationsNettes = Math.round(comptesCles.immobilisations - comptesCles.amortissements);
  const endettementRatio = capitauxPropres > 0 ? Math.round((dettesTotal / capitauxPropres) * 100) : null;

  const anomalies = [];
  const ecartEquilibre = Math.round(Math.abs(totalDebit - totalCredit));
  if (ecartEquilibre > 1) anomalies.push(`La balance n'est pas équilibrée : écart de ${ecartEquilibre.toLocaleString("fr-FR")} DH entre le total des débits (${Math.round(totalDebit).toLocaleString("fr-FR")}) et des crédits (${Math.round(totalCredit).toLocaleString("fr-FR")}).`);
  if (chiffreAffaires === 0) anomalies.push("Aucun compte de ventes (classe 71) détecté : le chiffre d'affaires n'a pas pu être identifié dans cette balance.");
  if (tresorerie < 0) anomalies.push("Le solde de trésorerie (classe 5) est négatif d'après cette balance.");
  if (rows.length < 5) anomalies.push("Le nombre de lignes comptables extraites est très faible : vérifiez que le fichier importé contient bien l'intégralité de la balance.");

  return {
    soldesParClasse,
    libellesClasses: LIBELLES_CLASSES,
    chiffreAffaires,
    charges: chargesClasse6,
    resultatEstime,
    immobilisations: immobilisationsNettes,
    dettes: dettesTotal,
    creances: creancesTotal,
    tresorerie,
    capitauxPropres: Math.round(capitauxPropres),
    endettementRatio,
    nombreLignes: rows.length,
    totalDebit: Math.round(totalDebit),
    totalCredit: Math.round(totalCredit),
    anomalies,
  };
}
