import { IS_BAREME, IR_BAREME, TVA_PAR_SECTEUR, SAISONNALITE } from "../config/secteurs.js";

/**
 * Moteur financier — porté et généralisé depuis one_click_bp v2.html.
 * Toutes les fonctions sont pures (entrées -> sorties, pas d'accès DOM/DB)
 * afin d'être réutilisées à la fois par les générateurs Excel/PDF et par les
 * futurs tests.
 */

export function calculImpotProgressif(base, bareme) {
  if (base <= 0) return 0;
  let impot = 0;
  for (const [low, high, taux] of bareme) {
    if (base > low) {
      const tranche = Math.min(base, high) - low;
      impot += tranche * taux;
    } else break;
  }
  return Math.round(impot * 100) / 100;
}

export function calculImpotEntreprise(resultat, formeJuridique) {
  return formeJuridique === "Auto-entrepreneur" ? calculImpotProgressif(resultat, IR_BAREME) : calculImpotProgressif(resultat, IS_BAREME);
}

export function genererCPC(params) {
  const { ca1, croissance, chargesExtPct, masseSal, immobilisations, montantCredit, dureeCredit, tauxInteret, formeJuridique, achatsPct = 0.4 } = params;
  const annees = ["Année 1", "Année 2", "Année 3"];
  const ca = [0, 1, 2].map((i) => ca1 * Math.pow(1 + croissance / 100, i));
  const achats = ca.map((c) => c * achatsPct);
  const chargesExt = ca.map((c) => c * (chargesExtPct / 100));
  const impotsTaxes = ca.map((c) => c * 0.015);
  const chargesPersonnel = [0, 1, 2].map((i) => masseSal * Math.pow(1.04, i));
  const chargesPatronales = chargesPersonnel.map((v) => v * 0.2);
  const dotationAnnuelle = immobilisations > 0 ? immobilisations / 5 : 0;
  const dotations = [dotationAnnuelle, dotationAnnuelle, dotationAnnuelle];

  const margeBrute = [0, 1, 2].map((i) => ca[i] - achats[i]);
  const valeurAjoutee = [0, 1, 2].map((i) => margeBrute[i] - chargesExt[i]);
  const ebe = [0, 1, 2].map((i) => valeurAjoutee[i] - impotsTaxes[i] - chargesPersonnel[i] - chargesPatronales[i]);

  const chargesExploitation = [0, 1, 2].map((i) => achats[i] + chargesExt[i] + impotsTaxes[i] + chargesPersonnel[i] + dotations[i]);
  const resultatExploitation = [0, 1, 2].map((i) => ca[i] - chargesExploitation[i]);

  const chargesFinancieres = [0, 1, 2].map((i) => {
    if (i < dureeCredit) {
      const capitalRestant = montantCredit * (1 - i / dureeCredit);
      return Math.round(capitalRestant * (tauxInteret / 100) * 100) / 100;
    }
    return 0;
  });

  const resultatCourant = [0, 1, 2].map((i) => resultatExploitation[i] - chargesFinancieres[i]);
  const impots = resultatCourant.map((r) => calculImpotEntreprise(r, formeJuridique));
  const resultatNet = [0, 1, 2].map((i) => resultatCourant[i] - impots[i]);
  const capaciteAutofinancement = [0, 1, 2].map((i) => resultatNet[i] + dotations[i]);

  const rows = [
    { label: "Chiffre d'Affaires (HT)", vals: ca },
    { label: "Achats consommés", vals: achats.map((v) => -v) },
    { label: "Charges externes", vals: chargesExt.map((v) => -v) },
    { label: "Impôts & taxes", vals: impotsTaxes.map((v) => -v) },
    { label: "Charges de personnel", vals: chargesPersonnel.map((v) => -v) },
    { label: "Dotations aux amortissements", vals: dotations.map((v) => -v) },
    { label: "Total Charges d'Exploitation", vals: chargesExploitation.map((v) => -v) },
    { label: "Résultat d'Exploitation", vals: resultatExploitation },
    { label: "Charges financières (intérêts)", vals: chargesFinancieres.map((v) => -v) },
    { label: "Résultat Courant Avant Impôt", vals: resultatCourant },
    { label: "Impôt (IS/IR)", vals: impots.map((v) => -v) },
    { label: "Résultat Net", vals: resultatNet },
  ];

  return {
    rows, annees, ca, resultatNet, dotations, chargesFinancieres, achats, chargesExt, impotsTaxes,
    chargesPersonnel, chargesPatronales, margeBrute, valeurAjoutee, ebe, resultatExploitation,
    resultatCourant, impots, capaciteAutofinancement,
  };
}

export function genererSIG(cpc) {
  return [
    { label: "Chiffre d'Affaires (HT)", vals: cpc.ca, info: "Total des ventes de biens/services hors TVA." },
    { label: "(–) Achats consommés", vals: cpc.achats.map((v) => -v) },
    { label: "= Marge Brute", vals: cpc.margeBrute, bold: true, info: "CA − Achats consommés." },
    { label: "(–) Charges externes", vals: cpc.chargesExt.map((v) => -v) },
    { label: "= Valeur Ajoutée (VA)", vals: cpc.valeurAjoutee, bold: true, info: "Richesse créée par l'entreprise." },
    { label: "(–) Impôts & taxes", vals: cpc.impotsTaxes.map((v) => -v) },
    { label: "(–) Charges de personnel (brut)", vals: cpc.chargesPersonnel.map((v) => -v) },
    { label: "(–) Charges patronales (CNSS/AMO ≈20%)", vals: cpc.chargesPatronales.map((v) => -v) },
    { label: "= Excédent Brut d'Exploitation (EBE)", vals: cpc.ebe, bold: true, info: "Rentabilité opérationnelle avant amortissements." },
    { label: "(–) Dotations aux amortissements", vals: cpc.dotations.map((v) => -v) },
    { label: "= Résultat d'Exploitation", vals: cpc.resultatExploitation, bold: true },
    { label: "(–) Charges financières", vals: cpc.chargesFinancieres.map((v) => -v) },
    { label: "= Résultat Courant Avant Impôt", vals: cpc.resultatCourant, bold: true },
    { label: "(–) Impôt sur les sociétés / IR", vals: cpc.impots.map((v) => -v) },
    { label: "= Résultat Net", vals: cpc.resultatNet, bold: true },
    { label: "(+) Dotations aux amortissements", vals: cpc.dotations },
    { label: "= Capacité d'Autofinancement (CAF)", vals: cpc.capaciteAutofinancement, bold: true, info: "Ressource interne pour rembourser les dettes, investir ou distribuer." },
  ];
}

export function genererPlanFinancement(apport, credit, investissements, autresFinancements = 0, subventions = 0) {
  const bfrEstime = investissements * 0.05;
  const totalEmplois = investissements + bfrEstime;
  const totalRessources = apport + credit + autresFinancements + subventions;
  const ecart = totalRessources - totalEmplois;

  const emplois = [
    ["Immobilisations (matériel, agencements...)", investissements * 0.95],
    ["Frais de constitution / établissement", investissements * 0.05],
    ["Besoin en Fonds de Roulement (BFR) de démarrage", bfrEstime],
    ["TOTAL EMPLOIS", totalEmplois],
  ];

  const ressources = [
    ["Apport Personnel (Fonds propres)", apport],
    ["Emprunt Bancaire (Crédit)", credit],
    ["Autres financements / subventions", autresFinancements + subventions],
    [ecart >= 0 ? "Trésorerie de départ disponible" : "Complément à financer", Math.abs(ecart)],
    ["TOTAL RESSOURCES", ecart >= 0 ? totalRessources : totalEmplois],
  ];

  return { emplois, ressources, bfrEstime, ecart, totalEmplois, totalRessources };
}

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
export { MOIS };

export function genererTresorerieMensuelle(params) {
  const { ca1, chargesExtAn1, chargesPersAn1, secteur, apport, credit, investissements, delaiClients, delaiFourn } = params;
  let coeffs = SAISONNALITE[secteur] || Array(12).fill(1.0);
  const sum = coeffs.reduce((a, b) => a + b, 0);
  coeffs = coeffs.map((c) => (c / sum) * 12);

  const caMensuel = coeffs.map((c) => (ca1 / 12) * c);
  const chargesExtMensuel = Array(12).fill(chargesExtAn1 / 12);
  const chargesPersMensuel = Array(12).fill(chargesPersAn1 / 12);

  const decalClients = delaiClients > 0 ? 1 : 0;
  const decalFourn = delaiFourn > 0 ? 1 : 0;

  const encaissementsCA = [];
  for (let i = 0; i < 12; i++) {
    const idx = i - decalClients;
    encaissementsCA.push(idx >= 0 ? caMensuel[idx] : caMensuel[i] * 0.5);
  }
  const decaissementsExt = [];
  for (let i = 0; i < 12; i++) {
    const idx = i - decalFourn;
    decaissementsExt.push(idx >= 0 ? chargesExtMensuel[idx] : chargesExtMensuel[i]);
  }

  const tvaTaux = TVA_PAR_SECTEUR[secteur] ?? 0.2;
  const tvaCollectee = encaissementsCA.map((v) => v * tvaTaux);
  const tvaDeductible = decaissementsExt.map((v) => v * tvaTaux);
  const tvaAPayer = tvaCollectee.map((v, i) => Math.max(v - tvaDeductible[i], 0));

  const encaissementFinancement = Array(12).fill(0);
  encaissementFinancement[0] = apport + credit;
  const decaissementInvest = Array(12).fill(0);
  decaissementInvest[0] = investissements;

  const totalEncaissements = encaissementsCA.map((v, i) => v + tvaCollectee[i] + encaissementFinancement[i]);
  const totalDecaissements = decaissementsExt.map((v, i) => v + tvaDeductible[i] + chargesPersMensuel[i] + tvaAPayer[i] + decaissementInvest[i]);

  const fluxNet = totalEncaissements.map((v, i) => v - totalDecaissements[i]);
  let cumul = 0;
  const soldeCumule = fluxNet.map((v) => {
    cumul += v;
    return cumul;
  });

  return MOIS.map((m, i) => ({
    mois: m,
    encCA: encaissementsCA[i] + tvaCollectee[i],
    encFin: encaissementFinancement[i],
    totEnc: totalEncaissements[i],
    chgExt: decaissementsExt[i] + tvaDeductible[i],
    chgPers: chargesPersMensuel[i],
    invest: decaissementInvest[i],
    tva: tvaAPayer[i],
    totDec: totalDecaissements[i],
    fluxNet: fluxNet[i],
    soldeCumule: soldeCumule[i],
  }));
}

export function genererBilan(investissements, apport, credit, resultatNet, dotations, dureeCredit) {
  const annees = ["Année 1", "Année 2", "Année 3"];
  const immobNettes = [0, 1, 2].map((i) => {
    let cumDot = 0;
    for (let j = 0; j <= i; j++) cumDot += dotations[j];
    return Math.max(investissements - cumDot, 0);
  });
  const capPropres = [0, 1, 2].map((i) => {
    let cumRes = 0;
    for (let j = 0; j <= i; j++) cumRes += resultatNet[j];
    return apport + cumRes;
  });
  const detteRestante = [0, 1, 2].map((i) => (dureeCredit > 0 ? Math.max(credit * (1 - (i + 1) / dureeCredit), 0) : 0));

  const actifCirculant = [investissements * 0.1, investissements * 0.12, investissements * 0.14];
  const tresorerie = [];
  const totalActif = [];
  for (let i = 0; i < 3; i++) {
    const passifHorsTreso = capPropres[i] + detteRestante[i];
    const t = passifHorsTreso - immobNettes[i] - actifCirculant[i];
    tresorerie.push(t);
    totalActif.push(immobNettes[i] + actifCirculant[i] + t);
  }
  const totalPassif = [0, 1, 2].map((i) => capPropres[i] + detteRestante[i]);

  return {
    actif: {
      annees,
      rows: [
        ["Immobilisations nettes", immobNettes],
        ["Actif circulant (estimé)", actifCirculant],
        ["Trésorerie (estimée)", tresorerie],
        ["TOTAL ACTIF", totalActif],
      ],
    },
    passif: {
      annees,
      rows: [
        ["Capitaux Propres (cumulés)", capPropres],
        ["Dettes de financement (crédit restant)", detteRestante],
        ["Passif circulant (estimé)", [0, 0, 0]],
        ["TOTAL PASSIF", totalPassif],
      ],
    },
  };
}

export function genererRatios(cpc, bilan, apport, credit, investissements, nbEmployes) {
  const margeNette = cpc.ca.map((c, i) => (c > 0 ? (cpc.resultatNet[i] / c) * 100 : 0));
  const margeEBE = cpc.ca.map((c, i) => (c > 0 ? (cpc.ebe[i] / c) * 100 : 0));
  const rentabiliteFinanciere = cpc.resultatNet.map((r) => (apport > 0 ? (r / apport) * 100 : 0));
  const rentabiliteEco = cpc.resultatNet.map((r) => (investissements > 0 ? (r / investissements) * 100 : 0));
  const autonomieFin = bilan.actif.rows[3][1].map((totalActif, i) => {
    const capPropres = bilan.passif.rows[0][1][i];
    return totalActif > 0 ? (capPropres / totalActif) * 100 : 0;
  });
  const caParEmploye = cpc.ca.map((c) => (nbEmployes > 0 ? c / nbEmployes : c));
  const capaRemb = cpc.capaciteAutofinancement.map((caf) => (credit > 0 ? caf / (credit / Math.max(1, 3)) : null));
  const couvCharges = cpc.resultatExploitation.map((re, i) => (cpc.chargesFinancieres[i] > 0 ? re / cpc.chargesFinancieres[i] : null));

  return [
    { label: "Marge Nette (Résultat Net / CA)", vals: margeNette, unit: "%", info: ">5% est considéré sain pour une jeune PME marocaine." },
    { label: "Marge d'EBE (EBE / CA)", vals: margeEBE, unit: "%", info: "Rentabilité opérationnelle pure." },
    { label: "Rentabilité Financière — ROE (RN / Apport)", vals: rentabiliteFinanciere, unit: "%" },
    { label: "Rentabilité Économique (RN / Investissement)", vals: rentabiliteEco, unit: "%" },
    { label: "Autonomie Financière (Capitaux Propres / Total Actif)", vals: autonomieFin, unit: "%", info: "Les banques apprécient un ratio >30-40%." },
    { label: "Chiffre d'Affaires par Employé", vals: caParEmploye, unit: "DH" },
    { label: "Capacité de Remboursement (CAF / annuité moy.)", vals: capaRemb, unit: "x" },
    { label: "Couverture des Charges Financières (RE / Charges fin.)", vals: couvCharges, unit: "x", info: ">3x est rassurant pour un prêteur." },
  ];
}

export function genererTableauFinancement(cpc, bilan, apport, credit, investissements) {
  const cafs = cpc.capaciteAutofinancement;
  const remboursementsAnnuels = [0, 1, 2].map((i) => (i === 0 ? credit - bilan.passif.rows[1][1][0] : Math.max(bilan.passif.rows[1][1][i - 1] - bilan.passif.rows[1][1][i], 0)));
  const fluxExploitation = cafs;
  const fluxInvestissement = [investissements, 0, 0].map((v) => -v);
  const fluxFinancement = [0, 1, 2].map((i) => (i === 0 ? apport + credit - remboursementsAnnuels[0] : -remboursementsAnnuels[i]));
  const variationTreso = [0, 1, 2].map((i) => fluxExploitation[i] + fluxInvestissement[i] + fluxFinancement[i]);
  const tresorerieFin = bilan.actif.rows[2][1];
  return {
    rows: [
      { label: "Capacité d'Autofinancement (CAF)", vals: fluxExploitation },
      { label: "Flux net de Trésorerie d'Exploitation", vals: fluxExploitation, bold: true },
      { label: "Acquisitions d'immobilisations", vals: fluxInvestissement },
      { label: "Flux net de Trésorerie d'Investissement", vals: fluxInvestissement, bold: true },
      { label: "Apports / Crédits encaissés (Année 1)", vals: [0, 1, 2].map((i) => (i === 0 ? apport + credit : 0)) },
      { label: "Remboursements d'emprunts", vals: remboursementsAnnuels.map((v) => -v) },
      { label: "Flux net de Trésorerie de Financement", vals: fluxFinancement, bold: true },
      { label: "= Variation de Trésorerie de la période", vals: variationTreso, bold: true },
      { label: "Trésorerie en fin de période (cumulée)", vals: tresorerieFin, bold: true },
    ],
  };
}

export function calculerSeuilRentabilite(cpc) {
  const ca0 = cpc.ca[0];
  const chargesVariables = cpc.achats[0] + cpc.chargesExt[0];
  const chargesFixes = cpc.chargesPersonnel[0] + cpc.chargesPatronales[0] + cpc.dotations[0] + cpc.impotsTaxes[0] + cpc.chargesFinancieres[0];
  const tauxMargeVariable = ca0 > 0 ? 1 - chargesVariables / ca0 : 0;
  if (tauxMargeVariable <= 0) return null;
  const seuilCA = chargesFixes / tauxMargeVariable;
  const joursAtteinte = ca0 > 0 ? Math.round((seuilCA / ca0) * 365) : null;
  return { seuilCA, joursAtteinte: joursAtteinte && joursAtteinte <= 365 ? joursAtteinte : null, atteintDansAnnee1: joursAtteinte <= 365 };
}
