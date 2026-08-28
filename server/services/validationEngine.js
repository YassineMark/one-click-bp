import { WIZARD_STEPS } from "../config/wizardSchema.js";

const STEP_BY_ID = new Map(WIZARD_STEPS.map((s) => [s.id, s]));

// `champ` référence soit une étape entière ("investissement"), soit un champ précis
// d'une étape ("projet.nomProjet") — dans les deux cas le préfixe avant le premier
// point identifie l'étape du formulaire. `champ` peut aussi être un tableau quand
// plusieurs étapes permettent de corriger le même problème (ex: CA nul).
function etapesPourChamp(champ) {
  const champs = Array.isArray(champ) ? champ : [champ];
  const etapes = [];
  const vus = new Set();
  for (const c of champs) {
    const stepId = String(c).split(".")[0];
    const step = STEP_BY_ID.get(stepId);
    if (step && !vus.has(step.id)) {
      vus.add(step.id);
      etapes.push({ id: step.id, titre: step.title, icone: step.icon || "" });
    }
  }
  return etapes;
}

function libelleEtapes(etapes) {
  return etapes.map((e) => `« ${e.titre} »`).join(" ou ");
}

// Ajoute à chaque message le ou les étapes du formulaire où corriger le problème,
// et joint la liste d'étapes structurée (pour un lien direct côté interface).
function enrichirAvecEtape(items, { corrigez }) {
  return items.map((item) => {
    const etapes = etapesPourChamp(item.champ);
    if (etapes.length === 0) return { ...item, etapes: [] };
    const suffixe = corrigez ? ` → Corrigez ceci à l'étape ${libelleEtapes(etapes)}.` : ` (étape ${libelleEtapes(etapes)})`;
    return { ...item, etapes, message: item.message + suffixe };
  });
}

/**
 * Détecte, avant génération, les données manquantes / incohérentes.
 * `erreurs` = bloquant (empêche la génération) ; `avertissements` = informatif
 * (l'utilisateur peut continuer en connaissance de cause). Chaque entrée porte
 * un champ `etapes` (liste de {id, titre, icone}) identifiant la ou les étapes
 * du formulaire à modifier pour lever le problème, en plus du message qui le
 * mentionne déjà en toutes lettres.
 */
export function validerProjet(formData, inputs, cpc, pf) {
  const erreurs = [];
  const avertissements = [];

  if (!formData?.projet?.nomProjet) erreurs.push({ champ: "projet.nomProjet", message: "Le nom du projet est requis." });
  if (!formData?.projet?.secteur) erreurs.push({ champ: "projet.secteur", message: "Le secteur d'activité est requis." });
  if (!(formData?.produits?.length > 0)) avertissements.push({ champ: "produits", message: "Aucun produit/service détaillé n'a été renseigné : le chiffre d'affaires prévisionnel repose uniquement sur votre estimation directe." });

  if (inputs.investissements <= 0) erreurs.push({ champ: "investissement", message: "Le total des investissements est nul." });
  if (inputs.ca1 <= 0) erreurs.push({ champ: ["produits", "previsionsCommerciales"], message: "Le chiffre d'affaires Année 1 est nul." });

  if (pf.ecart < 0) {
    const tauxCouverture = pf.totalEmplois > 0 ? (pf.totalRessources / pf.totalEmplois) * 100 : 0;
    if (tauxCouverture < 80) {
      erreurs.push({ champ: "financement", message: `Le financement couvre seulement ${tauxCouverture.toFixed(0)}% du besoin total (${Math.round(pf.totalEmplois).toLocaleString("fr-FR")} DH).` });
    } else {
      avertissements.push({ champ: "financement", message: `Un besoin de financement complémentaire de ${Math.round(Math.abs(pf.ecart)).toLocaleString("fr-FR")} DH a été détecté pour couvrir le BFR de démarrage.` });
    }
  }

  const margeAn1 = inputs.ca1 > 0 ? (cpc.margeBrute[0] / inputs.ca1) * 100 : 0;
  if (margeAn1 < 0) erreurs.push({ champ: "produits", message: "La marge brute Année 1 est négative : les coûts directs dépassent le chiffre d'affaires prévu." });
  else if (margeAn1 < 10) avertissements.push({ champ: "produits", message: `La marge brute Année 1 est très faible (${margeAn1.toFixed(1)}%). Vérifiez vos prix de vente et coûts directs.` });

  if (cpc.resultatNet[0] < 0) avertissements.push({ champ: "resultat", message: "Le résultat net Année 1 est négatif. Ce n'est pas nécessairement bloquant pour un lancement, mais doit être justifié dans le dossier bancaire." });

  if (inputs.masseSal <= 0 && inputs.nbEmployes === 0 && !(formData?.ressourcesHumaines?.length > 0)) {
    avertissements.push({ champ: "ressourcesHumaines", message: "Aucune charge de personnel renseignée : vérifiez que le porteur de projet ne se rémunère pas et qu'aucun recrutement n'est prévu." });
  }

  const chargesDetail = formData?.charges || {};
  const totalChargesDetail = Object.values(chargesDetail).reduce((s, v) => s + (Number(v) || 0), 0);
  if (totalChargesDetail === 0) avertissements.push({ champ: "charges", message: "Aucune charge de fonctionnement détaillée (loyer, électricité, marketing...) n'a été saisie : une hypothèse sectorielle par défaut a été utilisée à la place." });

  if (formData?.produits?.length > 0) {
    const caProduits = formData.produits.reduce((s, p) => s + (Number(p.prixVente) || 0) * (Number(p.quantiteEstimeeParMois) || 0) * (Number(p.frequenceVenteParAn) || 12), 0);
    if (formData?.previsionsCommerciales?.caAnnee1Estime && caProduits > 0) {
      const ecartPct = Math.abs(Number(formData.previsionsCommerciales.caAnnee1Estime) - caProduits) / caProduits * 100;
      if (ecartPct > 40) {
        avertissements.push({ champ: "previsionsCommerciales", message: `Le CA Année 1 saisi manuellement (${Math.round(formData.previsionsCommerciales.caAnnee1Estime).toLocaleString("fr-FR")} DH) s'écarte de plus de 40% du CA calculé à partir des volumes/prix produits (${Math.round(caProduits).toLocaleString("fr-FR")} DH). Vérifiez la cohérence de vos hypothèses.` });
      }
    }
  }

  if (inputs.dureeCredit > 0 && inputs.credit > 0) {
    const annuiteApprox = inputs.credit / inputs.dureeCredit;
    if (cpc.capaciteAutofinancement[0] < annuiteApprox) {
      avertissements.push({ champ: "financement", message: "La capacité d'autofinancement Année 1 est inférieure à l'annuité moyenne de remboursement estimée : la capacité de remboursement doit être surveillée de près." });
    }
  }

  return {
    erreurs: enrichirAvecEtape(erreurs, { corrigez: true }),
    avertissements: enrichirAvecEtape(avertissements, { corrigez: false }),
    bloquant: erreurs.length > 0,
  };
}
