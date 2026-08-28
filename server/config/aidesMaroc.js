/**
 * Dispositifs marocains d'aide à l'entrepreneuriat.
 *
 * IMPORTANT — ne pas inventer de programme : seuls INTELAKA et FORSA sont
 * modélisés ici, avec les critères déjà utilisés dans la version précédente
 * de l'outil (one_click_bp v2.html). Ces critères, seuils et taux doivent
 * être revérifiés périodiquement auprès des sources officielles (Bank
 * Al-Maghrib / GPBM / CCG pour Intelaka, ANAPEC/Forsa pour Forsa) : ce fichier
 * est volontairement isolé du reste du code pour qu'une mise à jour des
 * règles n'impose de modifier ni le moteur d'éligibilité
 * (server/services/eligibilityEngine.js) ni les routes ni les générateurs de
 * documents. Ajouter un nouveau dispositif = ajouter un objet à ce tableau.
 *
 * Chaque critère renvoyé par evaluateCriteria a un `status` :
 *   'ok'      — condition remplie
 *   'ko'      — condition non remplie (bloquant)
 *   'inconnu' — donnée insuffisante pour trancher (zone grise)
 */

function fmtDH(n) {
  if (n === null || n === undefined || isNaN(n)) return "0 DH";
  const v = Math.round(Math.abs(n));
  return (n < 0 ? "-" : "") + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " DH";
}

export const AIDES_MAROC = [
  {
    id: "intelaka",
    nom: "INTELAKA",
    nomComplet: "Programme intégré d'appui et de financement des entreprises (INTELAKA)",
    source: "Convention-cadre État / Bank Al-Maghrib / GPBM / CCG",
    derniereMiseAJour: "2026-01-01",
    applicableA: ["nouvelle_entreprise", "nouvelle_activite"],
    resumeEligible:
      "Programme INTELAKA : financement jusqu'à 1,2 MDH à un taux d'intérêt préférentiel de 2% (TPME urbaines) ou taux bonifié en milieu rural, sans exigence de garanties personnelles hors projet (hors caution morale). Frais de dossier réduits et procédure accélérée via les banques partenaires.",
    resumeNonEligible:
      "Le montant de crédit demandé dépasse le plafond de 1,2 MDH fixé par le programme INTELAKA. Un financement bancaire classique ou une réduction du montant emprunté (apport personnel renforcé) doit être envisagé.",
    evaluateCriteria(ctx) {
      const { montantCredit, investissements, apport, dateCreationOuAncienneteConnue } = ctx;
      const apportRatio = investissements > 0 ? apport / investissements : 0;
      return [
        {
          id: "intel_montant",
          label: "Montant du crédit ≤ 1 200 000 DH",
          status: montantCredit <= 1200000 ? "ok" : "ko",
          explication:
            montantCredit <= 1200000
              ? `Le crédit demandé (${fmtDH(montantCredit)}) respecte le plafond fixé par la convention INTELAKA pour les TPME.`
              : `Le crédit demandé (${fmtDH(montantCredit)}) dépasse le plafond de 1 200 000 DH fixé par la convention-cadre INTELAKA.`,
        },
        {
          id: "intel_invest",
          label: "Investissement total ≤ 10 000 000 DH (catégorie TPME)",
          status: investissements <= 10000000 ? "ok" : "ko",
          explication:
            investissements <= 10000000
              ? `L'investissement (${fmtDH(investissements)}) classe le projet en TPME, catégorie cible du programme.`
              : `L'investissement (${fmtDH(investissements)}) dépasse le seuil TPME ; le projet relèverait d'un financement classique.`,
        },
        {
          id: "intel_apport",
          label: "Apport personnel (aucun minimum imposé hors garantie morale)",
          status: "ok",
          explication: `INTELAKA ne fixe pas d'apport minimal obligatoire ; un apport de ${fmtDH(apport)} (${(apportRatio * 100).toFixed(0)}% de l'investissement) reste recommandé pour rassurer la banque partenaire.`,
        },
        {
          id: "intel_age",
          label: "Entreprise nouvellement créée ou en activité < 5 ans",
          status: dateCreationOuAncienneteConnue ? "ok" : "inconnu",
          explication: dateCreationOuAncienneteConnue
            ? "Ancienneté déclarée compatible avec le programme."
            : "Critère déclaratif à confirmer avec la date de création / le Registre du Commerce — non vérifiable à partir des seules données saisies.",
        },
      ];
    },
  },
  {
    id: "forsa",
    nom: "FORSA",
    nomComplet: "Programme Forsa — prêt d'honneur et subvention à l'entrepreneuriat individuel",
    source: "ANAPEC / Plateforme officielle Forsa",
    derniereMiseAJour: "2026-01-01",
    applicableA: ["nouvelle_entreprise", "nouvelle_activite"],
    resumeEligible:
      "Programme FORSA : éligible à un prêt d'honneur à taux 0% pouvant atteindre 100 000 DH, complété par une subvention non remboursable pouvant représenter jusqu'à 10% du coût du projet. Inscription sur la plateforme officielle et formation à l'entrepreneuriat obligatoires avant déblocage des fonds.",
    resumeNonEligible:
      "Le besoin de financement dépasse le seuil de 100 000 DH généralement couvert par le prêt d'honneur Forsa. Ce programme peut être combiné en amont avec INTELAKA ou un apport personnel renforcé.",
    evaluateCriteria(ctx) {
      const { montantCredit, apport, formeJuridique, nombreAssocies } = ctx;
      const seuilForsaCredit = 100000;
      const coutTotal = apport + montantCredit;
      return [
        {
          id: "forsa_credit",
          label: "Besoin de financement ≤ 100 000 DH (prêt d'honneur)",
          status: montantCredit <= seuilForsaCredit ? "ok" : "ko",
          explication:
            montantCredit <= seuilForsaCredit
              ? `Le besoin de crédit (${fmtDH(montantCredit)}) entre dans le plafond du prêt d'honneur à taux 0% de Forsa.`
              : `Le besoin de crédit (${fmtDH(montantCredit)}) dépasse le plafond de 100 000 DH du prêt d'honneur Forsa. Réduisez le montant emprunté ou renforcez l'apport personnel.`,
        },
        {
          id: "forsa_cout",
          label: "Coût total du projet compatible avec la subvention (jusqu'à 10%)",
          status: coutTotal <= 1000000 ? "ok" : "ko",
          explication:
            coutTotal <= 1000000
              ? `Le coût global du projet (${fmtDH(coutTotal)}) reste dans une fourchette éligible à la subvention complémentaire Forsa.`
              : `Le coût global du projet (${fmtDH(coutTotal)}) est élevé pour un porteur de projet individuel type Forsa ; le plafond en vigueur doit être vérifié auprès de l'ANAPEC/Forsa.`,
        },
        {
          id: "forsa_porteur",
          label: "Porteur de projet individuel (personne physique, associé unique)",
          status: !nombreAssocies || nombreAssocies <= 1 ? "ok" : "inconnu",
          explication:
            !nombreAssocies || nombreAssocies <= 1
              ? `Forsa cible prioritairement les porteurs de projet individuels. Une forme ${formeJuridique || "juridique"} reste éligible si le porteur est associé fondateur unique.`
              : `Le projet compte ${nombreAssocies} associé(s) déclaré(s) : à vérifier auprès de Forsa si tous les associés respectent le profil individuel exigé.`,
        },
        {
          id: "forsa_inscription",
          label: "Inscription plateforme officielle + formation entrepreneuriat suivie",
          status: "inconnu",
          explication: "Étape administrative obligatoire avant déblocage des fonds, indépendante des données financières saisies ici — à réaliser sur la plateforme officielle Forsa.",
        },
      ];
    },
  },
];
