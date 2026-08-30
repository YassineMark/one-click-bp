import {
  CHARGES_EXT_PCT_DEFAUT,
  CROISSANCE_DEFAUT_PCT,
  DELAI_CLIENTS_DEFAUT,
  DELAI_FOURNISSEURS_DEFAUT,
  STOCK_JOURS_DEFAUT,
} from "../config/secteurs.js";

export const SOURCE = {
  SAISIE: "saisie_utilisateur",
  CALCULEE: "hypothese_calculee",
  REFERENCE: "hypothese_de_reference",
};

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sumInvestissement(inv = {}) {
  const postes = ["local", "travaux", "equipement", "machines", "informatique", "mobilier", "vehicule", "logiciels", "licences", "stockInitial", "communication", "fraisCreation", "autres"];
  return postes.reduce((total, key) => total + num(inv[key]), 0);
}

function sumChargesAnnuelles(charges = {}) {
  const postes = ["loyer", "electricite", "eau", "internet", "telecommunications", "marketing", "transport", "assurance", "comptabilite", "logiciels", "maintenance", "matieresPremiere", "fraisBancaires", "taxes", "autres"];
  return postes.reduce((total, key) => total + num(charges[key]), 0);
}

function caDepuisProduits(produits = []) {
  return produits.reduce((total, p) => {
    const prix = num(p.prixVente);
    const qte = num(p.quantiteEstimeeParMois);
    const freqParAn = num(p.frequenceVenteParAn, 12);
    return total + prix * qte * freqParAn;
  }, 0);
}

function massSalarialeDepuisRH(rh = []) {
  return rh.reduce((total, poste) => total + num(poste.salaireBrutMensuel) * num(poste.nombre, 1) * 12, 0);
}

function nbEmployesDepuisRH(rh = []) {
  return rh.reduce((total, poste) => total + num(poste.nombre, 1), 0);
}

// Sélectionne le texte dans la langue demandée (fr / en / darija), avec repli sur le français.
function tr(lang, variants) {
  return variants[lang] || variants.fr;
}

const LABELS = {
  investissements: { fr: "Investissement total", en: "Total investment", darija: "مجموع الاستثمار" },
  apport: { fr: "Apport personnel total", en: "Total personal contribution", darija: "مجموع المساهمة الشخصية" },
  credit: { fr: "Crédit bancaire souhaité", en: "Requested bank loan", darija: "القرض البنكي اللي بغيتي" },
  autresFinancements: { fr: "Autres financements", en: "Other financing", darija: "تمويلات خرى" },
  subventions: { fr: "Subventions envisagées", en: "Planned grants", darija: "الإعانات المتوقعة" },
  ca1: { fr: "Chiffre d'affaires Année 1", en: "Year 1 revenue", darija: "رقم المعاملات — السنة 1" },
  croissance: { fr: "Croissance annuelle du CA", en: "Annual revenue growth", darija: "معدل الزيادة السنوية ديال رقم المعاملات" },
  chargesExtPct: { fr: "Charges externes (% du CA)", en: "External expenses (% of revenue)", darija: "المصاريف الخارجية (% من رقم المعاملات)" },
  masseSalariale: { fr: "Masse salariale annuelle", en: "Annual payroll", darija: "الأجور السنوية ديال الخدامة" },
  nbEmployes: { fr: "Nombre d'employés", en: "Number of employees", darija: "عدد الخدامة" },
  dureeCredit: { fr: "Durée du crédit", en: "Loan term", darija: "مدة القرض" },
  tauxInteret: { fr: "Taux d'intérêt annuel", en: "Annual interest rate", darija: "نسبة الفائدة ديال العام" },
  delaiClients: { fr: "Délai de paiement clients", en: "Customer payment terms", darija: "المدة باش يخلصوك الزبناء" },
  delaiFourn: { fr: "Délai de paiement fournisseurs", en: "Supplier payment terms", darija: "المدة باش تخلص الموردين" },
  stockJours: { fr: "Stock moyen (jours)", en: "Average stock (days)", darija: "المخزون المتوسط (أيام)" },
};

/**
 * Construit les hypothèses financières normalisées à partir des réponses du
 * formulaire. Chaque hypothèse renvoyée porte une `source` explicite :
 * l'utilisateur ne doit jamais voir une estimation présentée comme une
 * donnée officielle (règle du cahier des charges, section 15).
 *
 * `lang` (fr | en | darija) localise le libellé ET l'explication de chaque
 * hypothèse : ce sont les seules données de `bp` consommées par l'onglet
 * "Hypothèses" du classeur Entrepreneur (server/services/excelBuilder/entrepreneurWorkbook.js),
 * qui doit être intégralement dans la langue choisie par l'entrepreneur.
 * Les documents Banque/Aide n'utilisent jamais `bp.hypotheses` et restent
 * donc toujours en français quel que soit `lang` (voir server/services/analysisService.js).
 */
export function construireHypotheses(formData, lang = "fr") {
  const secteur = formData?.projet?.secteur || "Services";
  const formeJuridique = formData?.structureJuridique?.formeJuridique || "SARL";
  const hypotheses = [];
  const add = (champ, valeur, source, explication) => {
    hypotheses.push({ champ, label: tr(lang, LABELS[champ]), valeur, source, explication });
    return valeur;
  };

  const investissement = formData?.investissement || {};
  const investTotal = sumInvestissement(investissement);
  add("investissements", investTotal, SOURCE.CALCULEE, tr(lang, {
    fr: "Somme des postes d'investissement saisis (local, travaux, équipement, machines, informatique, mobilier, véhicule, logiciels, licences, stock initial, communication, frais de création, autres).",
    en: "Sum of the investment items entered (premises, works, equipment, machines, IT equipment, furniture, vehicle, software, licenses, initial stock, communication, incorporation costs, other).",
    darija: "مجموع كل بنود الاستثمار اللي دخلتي (المحل، الأشغال، التجهيزات، الماكينات، المعلوماتية، الموبيليا، السيارة، البرامج، الرخص، المخزون الأولي، التواصل، مصاريف التأسيس، وأشياء أخرى).",
  }));

  const financement = formData?.financement || {};
  const apport = num(financement.apportPersonnel) + num(financement.apportAssocies);
  add("apport", apport, SOURCE.SAISIE, tr(lang, {
    fr: "Apport personnel + apports des associés saisis à l'étape Financement.",
    en: "Personal contribution + partners' contributions entered in the Financing step.",
    darija: "المساهمة الشخصية زائد مساهمات الشركاء اللي دخلتيهم فمرحلة التمويل.",
  }));
  const credit = add("credit", num(financement.creditBancaireSouhaite), SOURCE.SAISIE, tr(lang, {
    fr: "Montant saisi à l'étape Financement.",
    en: "Amount entered in the Financing step.",
    darija: "المبلغ اللي دخلتي فمرحلة التمويل.",
  }));
  const autresFinancements = add("autresFinancements", num(financement.autresFinancements), SOURCE.SAISIE, tr(lang, {
    fr: "Autres financements saisis (hors subvention).",
    en: "Other financing entered (excluding grants).",
    darija: "تمويلات خرى دخلتيهم (ماعدا الإعانات).",
  }));
  const subventions = add("subventions", num(financement.subventionsEnvisagees), SOURCE.SAISIE, tr(lang, {
    fr: "Subventions envisagées, non garanties tant que l'éligibilité n'est pas confirmée.",
    en: "Planned grants, not guaranteed until eligibility is confirmed.",
    darija: "إعانات متوقعة، ماشي مضمونة حتى تتأكد الأهلية.",
  }));

  const previ = formData?.previsionsCommerciales || {};
  const produits = formData?.produits || [];
  let ca1;
  if (previ.caAnnee1Estime !== undefined && previ.caAnnee1Estime !== null && previ.caAnnee1Estime !== "") {
    ca1 = add("ca1", num(previ.caAnnee1Estime), SOURCE.SAISIE, tr(lang, {
      fr: "Chiffre d'affaires Année 1 estimé directement par le porteur de projet.",
      en: "Year 1 revenue estimated directly by the project owner.",
      darija: "رقم المعاملات ديال السنة الأولى، قدرو صاحب المشروع بنفسه.",
    }));
  } else {
    const caCalcule = caDepuisProduits(produits);
    ca1 = add("ca1", caCalcule, SOURCE.CALCULEE, tr(lang, {
      fr: "Calculé à partir des produits/services saisis : Σ (prix de vente × quantité mensuelle estimée × fréquence de vente annuelle).",
      en: "Calculated from the products/services entered: Σ (selling price × estimated monthly quantity × annual selling frequency).",
      darija: "محسوب من المنتوجات/الخدمات اللي دخلتي: مجموع (ثمن البيع × الكمية ديال الشهر × عدد الشهور اللي كتبيع فيهم فالعام).",
    }));
  }

  const croissance =
    previ.croissanceAnnuellePct !== undefined && previ.croissanceAnnuellePct !== null && previ.croissanceAnnuellePct !== ""
      ? add("croissance", num(previ.croissanceAnnuellePct), SOURCE.SAISIE, tr(lang, {
          fr: "Taux de croissance annuel saisi par l'utilisateur.",
          en: "Annual growth rate entered by the user.",
          darija: "معدل الزيادة السنوية اللي حطيتي نتا.",
        }))
      : add("croissance", CROISSANCE_DEFAUT_PCT, SOURCE.REFERENCE, tr(lang, {
          fr: `Aucune hypothèse de croissance saisie : valeur de référence usuelle retenue (${CROISSANCE_DEFAUT_PCT}%/an), à ajuster si besoin.`,
          en: `No growth assumption entered: a standard reference value was used (${CROISSANCE_DEFAUT_PCT}%/year), adjustable if needed.`,
          darija: `ما دخلتيش شي فرضية ديال النمو: تخدمنا بقيمة مرجعية عادية (${CROISSANCE_DEFAUT_PCT}% فالعام)، يمكن تبدلها إلا احتجتي.`,
        }));

  const chargesRaw = formData?.charges || {};
  const chargesAnnuelles = sumChargesAnnuelles(chargesRaw);
  let chargesExtPct;
  if (chargesAnnuelles > 0 && ca1 > 0) {
    chargesExtPct = add("chargesExtPct", (chargesAnnuelles / ca1) * 100, SOURCE.CALCULEE, tr(lang, {
      fr: "Calculé à partir des charges détaillées saisies (loyer, électricité, eau, internet, télécoms, marketing, transport, assurance, comptabilité, logiciels, maintenance, matières premières, frais bancaires, taxes, autres) rapportées au CA Année 1.",
      en: "Calculated from the detailed expenses entered (rent, electricity, water, internet, telecoms, marketing, transport, insurance, accounting, software, maintenance, raw materials, bank fees, taxes, other) relative to Year 1 revenue.",
      darija: "محسوب من المصاريف المفصلة اللي دخلتي (الكراء، الضو، الما، الأنترنيت، الاتصالات، التسويق، النقل، التأمين، المحاسبة، البرامج، الصيانة، المواد الأولية، مصاريف البنك، الضرائب، خرى) مقسومة على رقم المعاملات ديال السنة الأولى.",
    }));
  } else {
    const defaut = CHARGES_EXT_PCT_DEFAUT[secteur] ?? 40;
    chargesExtPct = add("chargesExtPct", defaut, SOURCE.REFERENCE, tr(lang, {
      fr: `Charges détaillées insuffisantes pour un calcul direct : valeur de référence usuelle pour le secteur ${secteur} (${defaut}% du CA).`,
      en: `Detailed expenses insufficient for a direct calculation: a standard reference value for the ${secteur} sector was used (${defaut}% of revenue).`,
      darija: `المصاريف المفصلة ما كافيينش باش نحسبو بشكل مباشر: تخدمنا بقيمة مرجعية ديال قطاع ${secteur} (${defaut}% من رقم المعاملات).`,
    }));
  }

  const rh = formData?.ressourcesHumaines || [];
  let masseSal, nbEmployes;
  if (rh.length > 0) {
    masseSal = add("masseSalariale", massSalarialeDepuisRH(rh), SOURCE.CALCULEE, tr(lang, {
      fr: "Somme des salaires bruts mensuels × nombre de postes × 12, à partir de la liste des recrutements prévus.",
      en: "Sum of monthly gross salaries × number of positions × 12, based on the planned hiring list.",
      darija: "مجموع الأجور الشهرية الخام × عدد المناصب × 12، بناءً على لائحة التوظيفات المتوقعة.",
    }));
    nbEmployes = add("nbEmployes", nbEmployesDepuisRH(rh), SOURCE.SAISIE, tr(lang, {
      fr: "Somme des effectifs saisis dans la liste Ressources Humaines.",
      en: "Sum of the headcounts entered in the Human Resources list.",
      darija: "مجموع العدد اللي دخلتي فلائحة الموارد البشرية.",
    }));
  } else {
    masseSal = add("masseSalariale", num(chargesRaw.salaires), SOURCE.SAISIE, tr(lang, {
      fr: "Montant de salaires saisi directement (aucun poste détaillé renseigné).",
      en: "Salary amount entered directly (no detailed position provided).",
      darija: "مبلغ الأجور دخلتيه مباشرة (ما حطيتيش شي منصب بالتفصيل).",
    }));
    nbEmployes = add("nbEmployes", 0, SOURCE.SAISIE, tr(lang, {
      fr: "Aucun poste renseigné dans Ressources Humaines.",
      en: "No position provided in Human Resources.",
      darija: "ما دخلتيش حتى منصب فالموارد البشرية.",
    }));
  }

  const dureeCredit =
    financement.dureeCredit !== undefined && financement.dureeCredit !== null && financement.dureeCredit !== ""
      ? add("dureeCredit", num(financement.dureeCredit, 5), SOURCE.SAISIE, tr(lang, {
          fr: "Durée saisie par l'utilisateur.",
          en: "Term entered by the user.",
          darija: "المدة اللي حطيتي نتا.",
        }))
      : add("dureeCredit", 5, SOURCE.REFERENCE, tr(lang, {
          fr: "Aucune durée saisie : durée usuelle de 5 ans retenue par défaut.",
          en: "No term entered: a standard 5-year term was used by default.",
          darija: "ما دخلتيش شي مدة: تخدمنا بمدة عادية ديال 5 سنين.",
        }));

  const tauxInteretDefaut = credit > 0 && credit <= 1200000 ? 2 : 5.5;
  const tauxInteret =
    financement.tauxInteret !== undefined && financement.tauxInteret !== null && financement.tauxInteret !== ""
      ? add("tauxInteret", num(financement.tauxInteret, 5.5), SOURCE.SAISIE, tr(lang, {
          fr: "Taux saisi par l'utilisateur.",
          en: "Rate entered by the user.",
          darija: "النسبة اللي حطيتي نتا.",
        }))
      : add("tauxInteret", tauxInteretDefaut, SOURCE.REFERENCE, tauxInteretDefaut === 2
          ? tr(lang, {
              fr: "Taux préférentiel usuel du programme INTELAKA (2%) retenu par défaut car le crédit demandé entre dans son plafond — à confirmer avec la banque.",
              en: "Standard preferential rate of the INTELAKA program (2%) used by default because the requested loan falls within its cap — to be confirmed with the bank.",
              darija: "تخدمنا بالنسبة التفضيلية ديال برنامج إنطلاقة (2%) حيت القرض اللي طلبتي داخل فالسقف ديالو — خاصك تتأكد منها مع البنك.",
            })
          : tr(lang, {
              fr: "Taux bancaire classique usuel au Maroc (5,5%) retenu par défaut — à confirmer avec la banque.",
              en: "Standard bank rate usually applied in Morocco (5.5%) used by default — to be confirmed with the bank.",
              darija: "تخدمنا بالنسبة البنكية العادية فالمغرب (5.5%) — خاصك تتأكد منها مع البنك.",
            }));

  const delaiClients =
    previ.delaiPaiementClients !== undefined && previ.delaiPaiementClients !== null && previ.delaiPaiementClients !== ""
      ? add("delaiClients", num(previ.delaiPaiementClients), SOURCE.SAISIE, tr(lang, {
          fr: "Délai saisi par l'utilisateur.",
          en: "Term entered by the user.",
          darija: "المدة اللي حطيتي نتا.",
        }))
      : add("delaiClients", DELAI_CLIENTS_DEFAUT[secteur] ?? 45, SOURCE.REFERENCE, tr(lang, {
          fr: `Valeur usuelle pour le secteur ${secteur}.`,
          en: `Standard value for the ${secteur} sector.`,
          darija: `قيمة عادية بالنسبة لقطاع ${secteur}.`,
        }));

  const delaiFourn =
    previ.delaiPaiementFournisseurs !== undefined && previ.delaiPaiementFournisseurs !== null && previ.delaiPaiementFournisseurs !== ""
      ? add("delaiFourn", num(previ.delaiPaiementFournisseurs), SOURCE.SAISIE, tr(lang, {
          fr: "Délai saisi par l'utilisateur.",
          en: "Term entered by the user.",
          darija: "المدة اللي حطيتي نتا.",
        }))
      : add("delaiFourn", DELAI_FOURNISSEURS_DEFAUT[secteur] ?? 45, SOURCE.REFERENCE, tr(lang, {
          fr: `Valeur usuelle pour le secteur ${secteur}.`,
          en: `Standard value for the ${secteur} sector.`,
          darija: `قيمة عادية بالنسبة لقطاع ${secteur}.`,
        }));

  const stockJours =
    previ.stockMoyenJours !== undefined && previ.stockMoyenJours !== null && previ.stockMoyenJours !== ""
      ? add("stockJours", num(previ.stockMoyenJours), SOURCE.SAISIE, tr(lang, {
          fr: "Valeur saisie par l'utilisateur.",
          en: "Value entered by the user.",
          darija: "القيمة اللي حطيتي نتا.",
        }))
      : add("stockJours", STOCK_JOURS_DEFAUT[secteur] ?? 30, SOURCE.REFERENCE, tr(lang, {
          fr: `Valeur usuelle pour le secteur ${secteur}.`,
          en: `Standard value for the ${secteur} sector.`,
          darija: `قيمة عادية بالنسبة لقطاع ${secteur}.`,
        }));

  return {
    inputs: {
      nomProjet: formData?.projet?.nomProjet || "Mon Projet",
      secteur,
      ville: formData?.localisation?.ville || formData?.marche?.ville || "Casablanca",
      formeJuridique,
      apport,
      credit,
      autresFinancements,
      subventions,
      investissements: investTotal,
      ca1,
      croissance,
      chargesExtPct,
      masseSal,
      nbEmployes,
      dureeCredit,
      tauxInteret,
      delaiClients,
      delaiFourn,
      stockJours,
    },
    hypotheses,
  };
}
