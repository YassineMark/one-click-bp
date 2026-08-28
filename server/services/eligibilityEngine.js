import { AIDES_MAROC } from "../config/aidesMaroc.js";

/**
 * Construit le contexte d'évaluation attendu par les critères des dispositifs
 * à partir des données brutes du formulaire + du moteur financier.
 */
function buildContext(formData, financials) {
  return {
    montantCredit: financials.credit,
    apport: financials.apport,
    investissements: financials.investissements,
    formeJuridique: formData.formeJuridique,
    nombreAssocies: Number(formData.nombreAssocies) || 1,
    dateCreationOuAncienneteConnue: formData.projectType === "nouvelle_entreprise" ? true : Boolean(formData.dateCreationEntreprise),
  };
}

/**
 * status global d'un dispositif :
 *  - 'eligible'     : tous les critères sont 'ok'
 *  - 'non_eligible' : au moins un critère bloquant est 'ko'
 *  - 'zone_grise'   : aucun 'ko', mais au moins un critère 'inconnu'
 */
function statutGlobal(criteres) {
  if (criteres.some((c) => c.status === "ko")) return "non_eligible";
  if (criteres.some((c) => c.status === "inconnu")) return "zone_grise";
  return "eligible";
}

function mesuresCorrectives(programme, criteres) {
  const problematiques = criteres.filter((c) => c.status === "ko" || c.status === "inconnu");
  return problematiques.map((c) => ({
    critere: c.label,
    statut: c.status,
    probleme: c.explication,
    action:
      c.status === "ko"
        ? `Ce critère est actuellement bloquant pour ${programme.nom}. Il doit être corrigé (ajustement du montant, de l'apport ou du plan de financement) pour redevenir éligible.`
        : `Information à compléter ou démarche administrative à réaliser avant de pouvoir confirmer l'éligibilité à ${programme.nom}.`,
  }));
}

export function evaluerEligibilites(formData, financials) {
  const ctx = buildContext(formData, financials);
  const projectType = formData.projectType || "nouvelle_entreprise";

  const resultats = AIDES_MAROC.filter((p) => p.applicableA.includes(projectType)).map((programme) => {
    const criteres = programme.evaluateCriteria(ctx);
    const statut = statutGlobal(criteres);
    const score = Math.round((criteres.filter((c) => c.status === "ok").length / criteres.length) * 100);
    return {
      id: programme.id,
      nom: programme.nom,
      nomComplet: programme.nomComplet,
      source: programme.source,
      derniereMiseAJour: programme.derniereMiseAJour,
      statut, // eligible | non_eligible | zone_grise
      score,
      criteres,
      resume:
        statut === "eligible"
          ? programme.resumeEligible
          : statut === "non_eligible"
          ? programme.resumeNonEligible
          : "Le projet est potentiellement éligible : certains critères nécessitent une information complémentaire ou une démarche administrative avant confirmation.",
      mesuresCorrectives: statut === "eligible" ? [] : mesuresCorrectives(programme, criteres),
    };
  });

  return { programmes: resultats, evalueAt: new Date().toISOString() };
}
