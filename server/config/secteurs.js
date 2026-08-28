/**
 * Données de référence sectorielles — Maroc.
 * Fichier isolé de la logique métier : une évolution des barèmes fiscaux ou
 * des hypothèses sectorielles se fait ici, sans toucher au moteur de calcul
 * (server/services/financialEngine.js) ni aux routes.
 *
 * Sources : barèmes IS/IR/TVA — Code Général des Impôts marocain (valeurs 2026
 * indicatives, à faire valider par un expert-comptable). Hypothèses de charges
 * externes et saisonnalité par secteur : valeurs usuelles indicatives, non
 * officielles — toujours présentées à l'utilisateur comme des estimations.
 */

export const IS_BAREME = [
  [0, 300000, 0.125],
  [300000, 1000000, 0.20],
  [1000000, Infinity, 0.225],
];

export const IR_BAREME = [
  [0, 40000, 0.00],
  [40000, 60000, 0.10],
  [60000, 80000, 0.20],
  [80000, 100000, 0.30],
  [100000, 180000, 0.34],
  [180000, Infinity, 0.37],
];

export const TVA_PAR_SECTEUR = { Services: 0.20, Commerce: 0.20, Industrie: 0.20, Agriculture: 0.00 };

export const SAISONNALITE = {
  Commerce: [0.7, 0.7, 0.8, 0.9, 1.0, 1.0, 0.8, 0.6, 1.0, 1.1, 1.3, 2.0],
  Services: [0.9, 0.9, 1.0, 1.0, 1.0, 1.0, 0.9, 0.8, 1.1, 1.1, 1.1, 1.2],
  Industrie: Array(12).fill(1.0),
  Agriculture: [0.5, 0.5, 0.7, 1.0, 1.4, 1.6, 1.6, 1.2, 0.8, 0.6, 0.5, 0.6],
};

// Charges externes usuelles en % du CA — sert de valeur par défaut ("hypothèse
// de référence") uniquement quand l'utilisateur n'a pas fourni de charges
// détaillées suffisantes pour les calculer directement.
export const CHARGES_EXT_PCT_DEFAUT = { Services: 35, Commerce: 55, Industrie: 45, Agriculture: 40 };

// Croissance annuelle usuelle retenue par défaut si l'utilisateur ne fournit
// pas d'hypothèse de croissance explicite.
export const CROISSANCE_DEFAUT_PCT = 12;

export const DELAI_CLIENTS_DEFAUT = { Services: 60, Commerce: 30, Industrie: 45, Agriculture: 30 };
export const DELAI_FOURNISSEURS_DEFAUT = { Services: 30, Commerce: 45, Industrie: 45, Agriculture: 30 };
export const STOCK_JOURS_DEFAUT = { Services: 5, Commerce: 45, Industrie: 60, Agriculture: 30 };

export const SECTEURS = ["Services", "Commerce", "Industrie", "Agriculture"];

export const FORMES_JURIDIQUES = ["Auto-entrepreneur", "SARL", "SARLAU", "SA", "Coopérative", "Autre"];
