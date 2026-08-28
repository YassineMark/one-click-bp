/**
 * Analyse de l'impact du lancement d'une nouvelle activité sur une entreprise
 * existante, à partir de la Balance Générale importée (si fournie) et des
 * projections de la nouvelle activité. Ne jamais inventer de donnée
 * historique : si aucune balance n'est fournie, le champ `disponible` est
 * false et les documents doivent l'indiquer explicitement.
 */
export function analyserImpactNouvelleActivite(balanceAnalysis, inputsNouvelleActivite) {
  if (!balanceAnalysis) {
    return {
      disponible: false,
      message: "Analyse financière historique non disponible : aucune Balance Générale n'a été fournie. L'analyse se base uniquement sur les informations saisies dans le formulaire pour la nouvelle activité.",
    };
  }

  const { chiffreAffaires, resultatEstime, tresorerie, capitauxPropres, dettes, endettementRatio } = balanceAnalysis;
  const investNouvelle = inputsNouvelleActivite.investissements;
  const creditNouvelle = inputsNouvelleActivite.credit;

  const capaciteInvestissement = tresorerie > 0 ? tresorerie + Math.max(capitauxPropres, 0) * 0.3 : Math.max(capitauxPropres, 0) * 0.3;
  const capaciteInvestissementSuffisante = capaciteInvestissement >= investNouvelle * 0.3;

  const nouvelEndettement = capitauxPropres > 0 ? ((dettes + creditNouvelle) / capitauxPropres) * 100 : null;
  const capaciteEndettementOk = nouvelEndettement === null ? null : nouvelEndettement < 150;

  const impactTresorerie = tresorerie - investNouvelle * 0.3; // hypothèse : ~30% de l'investissement décaissé sur trésorerie propre avant déblocage du crédit
  const risqueTresorerie = impactTresorerie < 0;

  const poidsNouvelleActiviteCA = chiffreAffaires > 0 ? (inputsNouvelleActivite.ca1 / chiffreAffaires) * 100 : null;

  const observations = [];
  observations.push(
    capaciteInvestissementSuffisante
      ? "La structure financière actuelle (trésorerie et capitaux propres) semble en mesure d'absorber une partie de l'investissement de la nouvelle activité."
      : "L'investissement prévu pour la nouvelle activité est élevé au regard de la trésorerie et des capitaux propres actuels de l'entreprise : un financement externe complémentaire (crédit, apport) est nécessaire."
  );
  if (nouvelEndettement !== null) {
    observations.push(
      capaciteEndettementOk
        ? `Le taux d'endettement projeté après le nouveau crédit (${nouvelEndettement.toFixed(0)}%) reste dans une fourchette généralement acceptable par les banques (<150% des capitaux propres).`
        : `Le taux d'endettement projeté après le nouveau crédit (${nouvelEndettement.toFixed(0)}%) est élevé : le dossier bancaire devra le justifier (garanties, capacité de remboursement).`
    );
  }
  observations.push(
    risqueTresorerie
      ? "Un risque de tension de trésorerie a été identifié au démarrage de la nouvelle activité : prévoir un fonds de roulement de sécurité ou un déblocage anticipé du crédit."
      : "La trésorerie actuelle devrait pouvoir couvrir les premiers décaissements de la nouvelle activité sans tension majeure."
  );
  if (poidsNouvelleActiviteCA !== null) {
    observations.push(`Le chiffre d'affaires attendu de la nouvelle activité représente environ ${poidsNouvelleActiviteCA.toFixed(0)}% du chiffre d'affaires actuel de l'entreprise — ${poidsNouvelleActiviteCA > 50 ? "un poids significatif qui justifie une analyse de complémentarité avec l'activité existante (risque de cannibalisation à vérifier)." : "un poids limité qui suggère une activité complémentaire plutôt que substitutive."}`);
  }
  if (resultatEstime < 0) observations.push("Le résultat estimé à partir de la balance importée est négatif : la capacité de l'entreprise à autofinancer la nouvelle activité doit être examinée avec prudence.");

  return {
    disponible: true,
    capaciteInvestissement: Math.round(capaciteInvestissement),
    capaciteInvestissementSuffisante,
    nouvelEndettementPct: nouvelEndettement === null ? null : Math.round(nouvelEndettement),
    capaciteEndettementOk,
    impactTresorerie: Math.round(impactTresorerie),
    risqueTresorerie,
    poidsNouvelleActiviteCA: poidsNouvelleActiviteCA === null ? null : Math.round(poidsNouvelleActiviteCA),
    observations,
  };
}
