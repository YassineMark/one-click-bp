import { SECTEURS, FORMES_JURIDIQUES } from "./secteurs.js";

/**
 * Schéma déclaratif du formulaire multi-étapes.
 * Le frontend (public/js/wizard.js) consomme ce schéma via
 * GET /api/wizard/schema pour construire dynamiquement les écrans : ajouter
 * ou modifier un champ se fait uniquement ici, sans toucher au HTML.
 *
 * `path` = chemin dans l'objet form_data (ex: "projet.nomProjet").
 * type: text | textarea | number | select | radio | list | boolean
 * Pour type "list", `itemFields` décrit les champs de chaque ligne répétable.
 */
export const WIZARD_STEPS = [
  {
    id: "porteur",
    title: "Profil du porteur de projet",
    icon: "👤",
    fields: [
      { path: "porteur.nomComplet", label: "Nom et prénom", type: "text", required: true },
      { path: "porteur.situationActuelle", label: "Situation professionnelle actuelle", type: "select", options: ["Salarié(e)", "Sans emploi", "Étudiant(e)", "Déjà entrepreneur(e)", "Fonctionnaire", "Autre"], required: true },
      { path: "porteur.formation", label: "Formation / diplôme le plus élevé", type: "text" },
      { path: "porteur.domaineExpertise", label: "Domaine d'expertise", type: "text" },
      { path: "porteur.experienceProfessionnelle", label: "Expérience professionnelle (résumé)", type: "textarea", help: "Postes occupés, secteurs, nombre d'années." },
      { path: "porteur.experienceEntrepreneuriale", label: "Expérience entrepreneuriale", type: "select", options: ["Aucune, première expérience", "Oui, avec succès", "Oui, expérience mitigée ou échec"], required: true },
      { path: "porteur.nombreAssocies", label: "Nombre d'associés (vous inclus)", type: "number", min: 1, default: 1, required: true },
      { path: "porteur.roleEntreprise", label: "Votre rôle prévu dans l'entreprise", type: "text", placeholder: "Gérant, Directeur général..." },
      { path: "porteur.apportPersonnelPrevu", label: "Apport personnel prévu (DH)", type: "number", min: 0, unit: "DH", help: "Sera repris automatiquement à l'étape Financement." },
    ],
  },
  {
    id: "projet",
    title: "Présentation du projet",
    icon: "💡",
    fields: [
      { path: "projet.nomProjet", label: "Nom du projet / de l'entreprise", type: "text", required: true },
      { path: "projet.secteur", label: "Secteur d'activité", type: "select", options: SECTEURS, required: true },
      { path: "projet.sousSecteur", label: "Sous-secteur / spécialité", type: "text" },
      { path: "projet.activitePrincipale", label: "Activité principale", type: "text", required: true },
      { path: "projet.description", label: "Description détaillée du projet", type: "textarea", required: true },
      { path: "projet.probleme", label: "Quel problème votre projet résout-il ?", type: "textarea" },
      { path: "projet.solution", label: "Quelle solution proposez-vous ?", type: "textarea" },
      { path: "projet.propositionValeur", label: "Proposition de valeur (en une phrase)", type: "text" },
      { path: "projet.objectifsCourtTerme", label: "Objectifs à court terme (0-1 an)", type: "textarea" },
      { path: "projet.objectifsMoyenTerme", label: "Objectifs à moyen terme (1-3 ans)", type: "textarea" },
      { path: "projet.objectifsLongTerme", label: "Objectifs à long terme (3-5 ans)", type: "textarea" },
    ],
  },
  {
    id: "produits",
    title: "Produits / Services",
    icon: "📦",
    fields: [
      {
        path: "produits", label: "Produits / services proposés", type: "list", minItems: 1,
        itemLabel: "Produit / service",
        itemFields: [
          { path: "nom", label: "Nom du produit/service", type: "text", required: true },
          { path: "description", label: "Description", type: "text" },
          { path: "prixVente", label: "Prix de vente unitaire (DH)", type: "number", min: 0, required: true },
          { path: "coutDirect", label: "Coût direct unitaire (DH)", type: "number", min: 0 },
          { path: "quantiteEstimeeParMois", label: "Quantité vendue estimée / mois", type: "number", min: 0 },
          { path: "frequenceVenteParAn", label: "Nombre de mois vendus / an", type: "number", min: 1, max: 12, default: 12 },
          { path: "margeSouhaitee", label: "Marge souhaitée (%)", type: "number", min: 0, max: 100 },
        ],
      },
    ],
  },
  {
    id: "marche",
    title: "Marché",
    icon: "🌍",
    fields: [
      { path: "marche.ville", label: "Ville cible principale", type: "text", required: true },
      { path: "marche.region", label: "Région", type: "text" },
      { path: "marche.portee", label: "Portée du marché", type: "select", options: ["Local", "Régional", "National"], required: true },
      { path: "marche.clienteleCible", label: "Clientèle visée", type: "select", options: ["Particuliers", "Entreprises", "Particuliers et entreprises", "Administrations"], required: true },
      { path: "marche.typeMarche", label: "Type de marché", type: "select", options: ["B2C", "B2B", "B2B2C"], required: true },
      { path: "marche.tailleMarcheEstimee", label: "Taille estimée du marché adressable (DH/an, si connue)", type: "number", min: 0 },
      { path: "marche.tendancesSecteur", label: "Tendances observées dans le secteur", type: "textarea" },
      { path: "marche.saisonnalite", label: "Le secteur est-il saisonnier ?", type: "select", options: ["Non", "Oui, légèrement", "Oui, fortement"] },
      { path: "marche.facteursDemande", label: "Principaux facteurs qui influencent la demande", type: "textarea" },
    ],
  },
  {
    id: "clients",
    title: "Clients",
    icon: "🧑‍🤝‍🧑",
    fields: [
      { path: "clients.profilClient", label: "Profil type du client", type: "textarea" },
      { path: "clients.ageCible", label: "Tranche d'âge cible", type: "text", placeholder: "ex : 25-45 ans" },
      { path: "clients.localisationClients", label: "Localisation des clients", type: "text" },
      { path: "clients.pouvoirAchat", label: "Pouvoir d'achat de la cible", type: "select", options: ["Faible", "Moyen", "Élevé", "Mixte"] },
      { path: "clients.besoins", label: "Principaux besoins des clients", type: "textarea" },
      { path: "clients.frequenceAchat", label: "Fréquence d'achat estimée", type: "text", placeholder: "ex : 1 fois/mois" },
      { path: "clients.panierMoyen", label: "Panier moyen estimé (DH)", type: "number", min: 0 },
      { path: "clients.nombreClientsPrevu", label: "Nombre de clients prévu Année 1", type: "number", min: 0 },
      { path: "clients.tauxCroissanceClients", label: "Taux de croissance du nombre de clients (%/an)", type: "number", min: 0 },
      { path: "clients.methodeAcquisition", label: "Méthode d'acquisition des clients", type: "textarea" },
    ],
  },
  {
    id: "concurrence",
    title: "Concurrence",
    icon: "⚔️",
    fields: [
      { path: "concurrence.connaitConcurrents", label: "Avez-vous identifié des concurrents ?", type: "boolean", default: false },
      {
        path: "concurrence.concurrents", label: "Concurrents identifiés", type: "list", showIf: "concurrence.connaitConcurrents",
        itemLabel: "Concurrent",
        itemFields: [
          { path: "nom", label: "Nom", type: "text" },
          { path: "prix", label: "Prix pratiqués", type: "text" },
          { path: "avantages", label: "Avantages", type: "text" },
          { path: "faiblesses", label: "Faiblesses", type: "text" },
        ],
      },
      { path: "concurrence.positionnementSouhaite", label: "Positionnement souhaité", type: "textarea" },
      { path: "concurrence.avantageConcurrentiel", label: "Votre avantage concurrentiel", type: "textarea" },
    ],
  },
  {
    id: "localisation",
    title: "Localisation",
    icon: "📍",
    fields: [
      { path: "localisation.ville", label: "Ville d'implantation", type: "text", required: true },
      { path: "localisation.quartier", label: "Quartier / zone", type: "text" },
      { path: "localisation.typeLocal", label: "Type de local", type: "select", options: ["Local commercial", "Bureau", "Atelier / entrepôt", "Aucun local (activité mobile/à domicile)"] },
      { path: "localisation.achatOuLocation", label: "Achat ou location", type: "select", options: ["Location", "Achat", "Non applicable"] },
      { path: "localisation.surfaceM2", label: "Surface (m²)", type: "number", min: 0 },
      { path: "localisation.loyerEstime", label: "Loyer mensuel estimé (DH)", type: "number", min: 0 },
      { path: "localisation.chargesLocatives", label: "Charges locatives mensuelles estimées (DH)", type: "number", min: 0 },
      { path: "localisation.accessibilite", label: "Accessibilité (transport, parking, visibilité)", type: "textarea" },
      { path: "localisation.travauxNecessaires", label: "Des travaux d'aménagement sont-ils nécessaires ?", type: "boolean", default: false },
      { path: "localisation.coutTravaux", label: "Coût estimé des travaux (DH)", type: "number", min: 0, showIf: "localisation.travauxNecessaires" },
    ],
  },
  {
    id: "ressourcesHumaines",
    title: "Ressources humaines",
    icon: "🧑‍💼",
    fields: [
      {
        path: "ressourcesHumaines", label: "Postes prévus", type: "list",
        itemLabel: "Poste",
        itemFields: [
          { path: "poste", label: "Intitulé du poste", type: "text", required: true },
          { path: "nombre", label: "Nombre de personnes", type: "number", min: 1, default: 1 },
          { path: "salaireBrutMensuel", label: "Salaire brut mensuel (DH)", type: "number", min: 0, required: true },
          { path: "dateEmbauchePrevue", label: "Date d'embauche prévue", type: "text", placeholder: "ex : Mois 1, Mois 6..." },
        ],
      },
      { path: "ressourcesHumaines_evolution", label: "Évolution prévue des effectifs sur 3 ans", type: "textarea" },
    ],
  },
  {
    id: "investissement",
    title: "Investissement initial",
    icon: "🏗️",
    description: "Montants uniques (DH), dépensés une seule fois au démarrage du projet — pas des coûts annuels ou mensuels. Ces dépenses seront amorties sur plusieurs années dans vos états financiers. Les coûts qui reviennent chaque année (loyer, électricité, salaires...) se saisissent à l'étape « Charges ».",
    computedTotal: "investissements",
    fields: [
      { path: "investissement.local", label: "Local — acquisition, pas de porte (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.travaux", label: "Travaux / aménagement (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.equipement", label: "Équipement (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.machines", label: "Machines (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.informatique", label: "Matériel informatique (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.mobilier", label: "Mobilier (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.vehicule", label: "Véhicule (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.logiciels", label: "Logiciels (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.licences", label: "Licences / agréments (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.stockInitial", label: "Stock initial (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.communication", label: "Communication de lancement (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.fraisCreation", label: "Frais de création d'entreprise (DH, montant unique)", type: "number", min: 0, default: 0 },
      { path: "investissement.autres", label: "Autres investissements (DH, montant unique)", type: "number", min: 0, default: 0 },
    ],
  },
  {
    id: "financement",
    title: "Financement",
    icon: "💰",
    computedTotal: "besoinFinancement",
    fields: [
      { path: "financement.apportPersonnel", label: "Apport personnel (DH)", type: "number", min: 0, default: 0 },
      { path: "financement.apportAssocies", label: "Apport des associés (DH)", type: "number", min: 0, default: 0 },
      { path: "financement.creditBancaireSouhaite", label: "Financement bancaire souhaité (DH)", type: "number", min: 0, default: 0 },
      { path: "financement.dureeCredit", label: "Durée du crédit souhaitée (années)", type: "number", min: 1, max: 15, default: 5 },
      { path: "financement.tauxInteret", label: "Taux d'intérêt annuel anticipé (%, si connu)", type: "number", min: 0, max: 15, step: 0.1 },
      { path: "financement.autresFinancements", label: "Autres financements (leasing, prêt d'honneur...)", type: "number", min: 0, default: 0 },
      { path: "financement.subventionsEnvisagees", label: "Subventions envisagées (DH)", type: "number", min: 0, default: 0 },
    ],
  },
  {
    id: "previsionsCommerciales",
    title: "Prévisions commerciales",
    icon: "📈",
    fields: [
      { path: "previsionsCommerciales.caAnnee1Estime", label: "Chiffre d'affaires Année 1 estimé (DH, optionnel)", type: "number", min: 0, help: "Si vous ne le renseignez pas, il sera calculé automatiquement à partir de vos produits/services." },
      { path: "previsionsCommerciales.croissanceAnnuellePct", label: "Croissance annuelle du CA (%, optionnel)", type: "number", min: 0, max: 100 },
      { path: "previsionsCommerciales.delaiPaiementClients", label: "Délai moyen de paiement clients (jours)", type: "number", min: 0, max: 180 },
      { path: "previsionsCommerciales.delaiPaiementFournisseurs", label: "Délai moyen de paiement fournisseurs (jours)", type: "number", min: 0, max: 180 },
      { path: "previsionsCommerciales.stockMoyenJours", label: "Stock moyen détenu (jours)", type: "number", min: 0, max: 365 },
    ],
  },
  {
    id: "charges",
    title: "Charges",
    icon: "🧾",
    computedTotal: "chargesAnnuelles",
    fields: [
      { path: "charges.loyer", label: "Loyer annuel (DH)", type: "number", min: 0, default: 0 },
      { path: "charges.electricite", label: "Électricité (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.eau", label: "Eau (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.internet", label: "Internet (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.telecommunications", label: "Télécommunications (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.marketing", label: "Marketing / communication (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.transport", label: "Transport (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.assurance", label: "Assurance (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.comptabilite", label: "Comptabilité / expert-comptable (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.logiciels", label: "Abonnements logiciels (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.maintenance", label: "Maintenance / entretien (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.matieresPremiere", label: "Matières premières / fournitures (annuel, hors coûts directs déjà saisis)", type: "number", min: 0, default: 0 },
      { path: "charges.fraisBancaires", label: "Frais bancaires (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.taxes", label: "Taxes diverses (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.autres", label: "Autres charges (annuel)", type: "number", min: 0, default: 0 },
      { path: "charges.salaires", label: "Salaires (si non détaillés dans Ressources Humaines)", type: "number", min: 0, default: 0 },
    ],
  },
  {
    id: "structureJuridique",
    title: "Fiscalité et structure juridique",
    icon: "⚖️",
    fields: [
      { path: "structureJuridique.formeJuridique", label: "Forme juridique envisagée", type: "select", options: FORMES_JURIDIQUES, required: true, help: "Information à titre indicatif — ne constitue pas un conseil juridique." },
      { path: "structureJuridique.capitalSocial", label: "Capital social envisagé (DH)", type: "number", min: 0 },
      { path: "structureJuridique.nombreAssocies", label: "Nombre d'associés", type: "number", min: 1, default: 1 },
    ],
  },
  {
    id: "situationFinanciereActuelle",
    title: "Situation financière actuelle de l'entreprise",
    icon: "🏢",
    onlyFor: "nouvelle_activite",
    fields: [
      { path: "situationFinanciereActuelle.commentaire", label: "Commentaire libre sur la situation actuelle (optionnel)", type: "textarea" },
    ],
    upload: {
      path: "situationFinanciereActuelle.balanceUploadId",
      label: "Balance générale (optionnel)",
      acceptedFormats: ["csv", "xlsx", "xls", "pdf"],
      maxSizeMB: 10,
      help: "Formats acceptés : Excel, CSV, PDF. Cet upload est optionnel — le formulaire fonctionne normalement sans ce fichier.",
    },
  },
  {
    id: "langue",
    title: "Langue du business plan",
    icon: "🌐",
    fields: [
      {
        path: "langueBusinessPlan", label: "Dans quelle langue souhaitez-vous recevoir votre business plan entrepreneur ?", type: "radio",
        options: [
          { value: "fr", label: "Français" },
          { value: "en", label: "Anglais" },
          { value: "darija", label: "الدارجة" },
        ],
        required: true, default: "fr",
        help: "Cette langue concerne uniquement les documents destinés à l'entrepreneur. Les documents pour les banques et les institutions d'aide sont toujours en français.",
      },
    ],
  },
];

export function stepsForProjectType(projectType) {
  return WIZARD_STEPS.filter((s) => !s.onlyFor || s.onlyFor === projectType);
}
