import { construireHypotheses } from "./hypothesisEngine.js";
import {
  genererCPC, genererSIG, genererPlanFinancement, genererTresorerieMensuelle,
  genererBilan, genererRatios, genererTableauFinancement, calculerSeuilRentabilite,
} from "./financialEngine.js";
import { evaluerEligibilites } from "./eligibilityEngine.js";
import { validerProjet } from "./validationEngine.js";
import { analyserImpactNouvelleActivite } from "./balanceComparisonEngine.js";

/**
 * Point d'entrée unique de l'analyse d'un projet : produit toutes les
 * données nécessaires à l'écran de récapitulatif ET aux générateurs de
 * documents (Excel/PDF), à partir des réponses brutes du formulaire.
 */
export function analyserProjet(formData, projectType, balanceAnalysis = null) {
  const langueBusinessPlan = formData.langueBusinessPlan || "fr";
  // `bp.hypotheses` alimente uniquement l'onglet "Hypothèses" du classeur Entrepreneur
  // (jamais les documents Banque/Aide, toujours en français) : on le construit donc
  // directement dans la langue choisie par l'entrepreneur.
  const { inputs, hypotheses } = construireHypotheses({ ...formData, projectType }, langueBusinessPlan);

  const cpc = genererCPC({
    ca1: inputs.ca1, croissance: inputs.croissance, chargesExtPct: inputs.chargesExtPct,
    masseSal: inputs.masseSal, immobilisations: inputs.investissements, montantCredit: inputs.credit,
    dureeCredit: inputs.dureeCredit, tauxInteret: inputs.tauxInteret, formeJuridique: inputs.formeJuridique,
  });
  const pf = genererPlanFinancement(inputs.apport, inputs.credit, inputs.investissements, inputs.autresFinancements, inputs.subventions);
  const treso = genererTresorerieMensuelle({
    ca1: cpc.ca[0], chargesExtAn1: cpc.ca[0] * (inputs.chargesExtPct / 100), chargesPersAn1: inputs.masseSal,
    secteur: inputs.secteur, apport: inputs.apport, credit: inputs.credit, investissements: inputs.investissements,
    delaiClients: inputs.delaiClients, delaiFourn: inputs.delaiFourn,
  });
  const bilan = genererBilan(inputs.investissements, inputs.apport, inputs.credit, cpc.resultatNet, cpc.dotations, inputs.dureeCredit);
  const ratios = genererRatios(cpc, bilan, inputs.apport, inputs.credit, inputs.investissements, inputs.nbEmployes);
  const tableauFinancement = genererTableauFinancement(cpc, bilan, inputs.apport, inputs.credit, inputs.investissements);
  const seuilRentabilite = calculerSeuilRentabilite(cpc);
  const sig = genererSIG(cpc);

  const eligibilites = evaluerEligibilites({ ...formData, projectType }, inputs);
  const validation = validerProjet(formData, inputs, cpc, pf);

  const impact = projectType === "nouvelle_activite" ? analyserImpactNouvelleActivite(balanceAnalysis, inputs) : null;

  return {
    projectType,
    inputs,
    hypotheses,
    cpc, sig, pf, treso, bilan, ratios, tableauFinancement, seuilRentabilite,
    eligibilites,
    validation,
    balance: { uploaded: Boolean(balanceAnalysis), analysis: balanceAnalysis, impact },
    langueBusinessPlan,
    generatedAt: new Date().toISOString(),
  };
}
