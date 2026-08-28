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

// Sélectionne le texte dans la langue demandée (fr / ar / darija), avec repli sur le français.
function tr(lang, variants) {
  return variants[lang] || variants.fr;
}

const LABELS = {
  investissements: { fr: "Investissement total", ar: "إجمالي الاستثمار", darija: "مجموع الاستثمار" },
  apport: { fr: "Apport personnel total", ar: "إجمالي المساهمة الشخصية", darija: "مجموع المساهمة الشخصية" },
  credit: { fr: "Crédit bancaire souhaité", ar: "القرض البنكي المطلوب", darija: "القرض البنكي اللي بغيتي" },
  autresFinancements: { fr: "Autres financements", ar: "تمويلات أخرى", darija: "تمويلات خرى" },
  subventions: { fr: "Subventions envisagées", ar: "الإعانات المتوخاة", darija: "الإعانات المتوقعة" },
  ca1: { fr: "Chiffre d'affaires Année 1", ar: "رقم الأعمال — السنة 1", darija: "رقم المعاملات — السنة 1" },
  croissance: { fr: "Croissance annuelle du CA", ar: "معدل النمو السنوي لرقم الأعمال", darija: "معدل الزيادة السنوية ديال رقم المعاملات" },
  chargesExtPct: { fr: "Charges externes (% du CA)", ar: "التكاليف الخارجية (% من رقم الأعمال)", darija: "المصاريف الخارجية (% من رقم المعاملات)" },
  masseSalariale: { fr: "Masse salariale annuelle", ar: "الكتلة الأجرية السنوية", darija: "الأجور السنوية ديال الخدامة" },
  nbEmployes: { fr: "Nombre d'employés", ar: "عدد المستخدمين", darija: "عدد الخدامة" },
  dureeCredit: { fr: "Durée du crédit", ar: "مدة القرض", darija: "مدة القرض" },
  tauxInteret: { fr: "Taux d'intérêt annuel", ar: "نسبة الفائدة السنوية", darija: "نسبة الفائدة ديال العام" },
  delaiClients: { fr: "Délai de paiement clients", ar: "أجل أداء الزبناء", darija: "المدة باش يخلصوك الزبناء" },
  delaiFourn: { fr: "Délai de paiement fournisseurs", ar: "أجل أداء الموردين", darija: "المدة باش تخلص الموردين" },
  stockJours: { fr: "Stock moyen (jours)", ar: "متوسط المخزون (أيام)", darija: "المخزون المتوسط (أيام)" },
};

/**
 * Construit les hypothèses financières normalisées à partir des réponses du
 * formulaire. Chaque hypothèse renvoyée porte une `source` explicite :
 * l'utilisateur ne doit jamais voir une estimation présentée comme une
 * donnée officielle (règle du cahier des charges, section 15).
 *
 * `lang` (fr | ar | darija) localise le libellé ET l'explication de chaque
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
    ar: "مجموع بنود الاستثمار المدخلة (المحل، الأشغال، التجهيزات، الآلات، المعدات المعلوماتية، الأثاث، السيارة، البرامج المعلوماتية، الرخص، المخزون الأولي، التواصل، مصاريف التأسيس، أخرى).",
    darija: "مجموع كل بنود الاستثمار اللي دخلتي (المحل، الأشغال، التجهيزات، الماكينات، المعلوماتية، الموبيليا، السيارة، البرامج، الرخص، المخزون الأولي، التواصل، مصاريف التأسيس، وأشياء أخرى).",
  }));

  const financement = formData?.financement || {};
  const apport = num(financement.apportPersonnel) + num(financement.apportAssocies);
  add("apport", apport, SOURCE.SAISIE, tr(lang, {
    fr: "Apport personnel + apports des associés saisis à l'étape Financement.",
    ar: "المساهمة الشخصية + مساهمات الشركاء المدخلة في مرحلة التمويل.",
    darija: "المساهمة الشخصية زائد مساهمات الشركاء اللي دخلتيهم فمرحلة التمويل.",
  }));
  const credit = add("credit", num(financement.creditBancaireSouhaite), SOURCE.SAISIE, tr(lang, {
    fr: "Montant saisi à l'étape Financement.",
    ar: "المبلغ المدخل في مرحلة التمويل.",
    darija: "المبلغ اللي دخلتي فمرحلة التمويل.",
  }));
  const autresFinancements = add("autresFinancements", num(financement.autresFinancements), SOURCE.SAISIE, tr(lang, {
    fr: "Autres financements saisis (hors subvention).",
    ar: "تمويلات أخرى مدخلة (بدون احتساب الإعانات).",
    darija: "تمويلات خرى دخلتيهم (ماعدا الإعانات).",
  }));
  const subventions = add("subventions", num(financement.subventionsEnvisagees), SOURCE.SAISIE, tr(lang, {
    fr: "Subventions envisagées, non garanties tant que l'éligibilité n'est pas confirmée.",
    ar: "إعانات متوخاة، غير مضمونة إلى حين تأكيد الأهلية.",
    darija: "إعانات متوقعة، ماشي مضمونة حتى تتأكد الأهلية.",
  }));

  const previ = formData?.previsionsCommerciales || {};
  const produits = formData?.produits || [];
  let ca1;
  if (previ.caAnnee1Estime !== undefined && previ.caAnnee1Estime !== null && previ.caAnnee1Estime !== "") {
    ca1 = add("ca1", num(previ.caAnnee1Estime), SOURCE.SAISIE, tr(lang, {
      fr: "Chiffre d'affaires Année 1 estimé directement par le porteur de projet.",
      ar: "رقم الأعمال للسنة الأولى، مقدَّر مباشرة من طرف حامل المشروع.",
      darija: "رقم المعاملات ديال السنة الأولى، قدرو صاحب المشروع بنفسه.",
    }));
  } else {
    const caCalcule = caDepuisProduits(produits);
    ca1 = add("ca1", caCalcule, SOURCE.CALCULEE, tr(lang, {
      fr: "Calculé à partir des produits/services saisis : Σ (prix de vente × quantité mensuelle estimée × fréquence de vente annuelle).",
      ar: "محسوب انطلاقاً من المنتجات/الخدمات المدخلة: مجموع (سعر البيع × الكمية الشهرية المقدَّرة × عدد أشهر البيع في السنة).",
      darija: "محسوب من المنتوجات/الخدمات اللي دخلتي: مجموع (ثمن البيع × الكمية ديال الشهر × عدد الشهور اللي كتبيع فيهم فالعام).",
    }));
  }

  const croissance =
    previ.croissanceAnnuellePct !== undefined && previ.croissanceAnnuellePct !== null && previ.croissanceAnnuellePct !== ""
      ? add("croissance", num(previ.croissanceAnnuellePct), SOURCE.SAISIE, tr(lang, {
          fr: "Taux de croissance annuel saisi par l'utilisateur.",
          ar: "معدل النمو السنوي الذي أدخله المستخدم.",
          darija: "معدل الزيادة السنوية اللي حطيتي نتا.",
        }))
      : add("croissance", CROISSANCE_DEFAUT_PCT, SOURCE.REFERENCE, tr(lang, {
          fr: `Aucune hypothèse de croissance saisie : valeur de référence usuelle retenue (${CROISSANCE_DEFAUT_PCT}%/an), à ajuster si besoin.`,
          ar: `لم يتم إدخال أي فرضية للنمو: تم اعتماد قيمة مرجعية معتادة (${CROISSANCE_DEFAUT_PCT}% سنوياً)، قابلة للتعديل عند الحاجة.`,
          darija: `ما دخلتيش شي فرضية ديال النمو: تخدمنا بقيمة مرجعية عادية (${CROISSANCE_DEFAUT_PCT}% فالعام)، يمكن تبدلها إلا احتجتي.`,
        }));

  const chargesRaw = formData?.charges || {};
  const chargesAnnuelles = sumChargesAnnuelles(chargesRaw);
  let chargesExtPct;
  if (chargesAnnuelles > 0 && ca1 > 0) {
    chargesExtPct = add("chargesExtPct", (chargesAnnuelles / ca1) * 100, SOURCE.CALCULEE, tr(lang, {
      fr: "Calculé à partir des charges détaillées saisies (loyer, électricité, eau, internet, télécoms, marketing, transport, assurance, comptabilité, logiciels, maintenance, matières premières, frais bancaires, taxes, autres) rapportées au CA Année 1.",
      ar: "محسوب انطلاقاً من التكاليف المفصلة المدخلة (الكراء، الكهرباء، الماء، الأنترنت، الاتصالات، التسويق، النقل، التأمين، المحاسبة، البرامج، الصيانة، المواد الأولية، المصاريف البنكية، الضرائب، أخرى) مقارنة برقم الأعمال للسنة الأولى.",
      darija: "محسوب من المصاريف المفصلة اللي دخلتي (الكراء، الضو، الما، الأنترنيت، الاتصالات، التسويق، النقل، التأمين، المحاسبة، البرامج، الصيانة، المواد الأولية، مصاريف البنك، الضرائب، خرى) مقسومة على رقم المعاملات ديال السنة الأولى.",
    }));
  } else {
    const defaut = CHARGES_EXT_PCT_DEFAUT[secteur] ?? 40;
    chargesExtPct = add("chargesExtPct", defaut, SOURCE.REFERENCE, tr(lang, {
      fr: `Charges détaillées insuffisantes pour un calcul direct : valeur de référence usuelle pour le secteur ${secteur} (${defaut}% du CA).`,
      ar: `المعطيات التفصيلية للتكاليف غير كافية لحساب مباشر: تم اعتماد قيمة مرجعية معتادة لقطاع ${secteur} (${defaut}% من رقم الأعمال).`,
      darija: `المصاريف المفصلة ما كافيينش باش نحسبو بشكل مباشر: تخدمنا بقيمة مرجعية ديال قطاع ${secteur} (${defaut}% من رقم المعاملات).`,
    }));
  }

  const rh = formData?.ressourcesHumaines || [];
  let masseSal, nbEmployes;
  if (rh.length > 0) {
    masseSal = add("masseSalariale", massSalarialeDepuisRH(rh), SOURCE.CALCULEE, tr(lang, {
      fr: "Somme des salaires bruts mensuels × nombre de postes × 12, à partir de la liste des recrutements prévus.",
      ar: "مجموع الأجور الشهرية الخام × عدد المناصب × 12، انطلاقاً من لائحة التوظيفات المتوقعة.",
      darija: "مجموع الأجور الشهرية الخام × عدد المناصب × 12، بناءً على لائحة التوظيفات المتوقعة.",
    }));
    nbEmployes = add("nbEmployes", nbEmployesDepuisRH(rh), SOURCE.SAISIE, tr(lang, {
      fr: "Somme des effectifs saisis dans la liste Ressources Humaines.",
      ar: "مجموع الأعداد المدخلة في لائحة الموارد البشرية.",
      darija: "مجموع العدد اللي دخلتي فلائحة الموارد البشرية.",
    }));
  } else {
    masseSal = add("masseSalariale", num(chargesRaw.salaires), SOURCE.SAISIE, tr(lang, {
      fr: "Montant de salaires saisi directement (aucun poste détaillé renseigné).",
      ar: "مبلغ الأجور مدخل مباشرة (لم يتم تحديد أي منصب بالتفصيل).",
      darija: "مبلغ الأجور دخلتيه مباشرة (ما حطيتيش شي منصب بالتفصيل).",
    }));
    nbEmployes = add("nbEmployes", 0, SOURCE.SAISIE, tr(lang, {
      fr: "Aucun poste renseigné dans Ressources Humaines.",
      ar: "لم يتم تحديد أي منصب في الموارد البشرية.",
      darija: "ما دخلتيش حتى منصب فالموارد البشرية.",
    }));
  }

  const dureeCredit =
    financement.dureeCredit !== undefined && financement.dureeCredit !== null && financement.dureeCredit !== ""
      ? add("dureeCredit", num(financement.dureeCredit, 5), SOURCE.SAISIE, tr(lang, {
          fr: "Durée saisie par l'utilisateur.",
          ar: "المدة التي أدخلها المستخدم.",
          darija: "المدة اللي حطيتي نتا.",
        }))
      : add("dureeCredit", 5, SOURCE.REFERENCE, tr(lang, {
          fr: "Aucune durée saisie : durée usuelle de 5 ans retenue par défaut.",
          ar: "لم يتم إدخال أي مدة: تم اعتماد مدة معتادة من 5 سنوات كقيمة افتراضية.",
          darija: "ما دخلتيش شي مدة: تخدمنا بمدة عادية ديال 5 سنين.",
        }));

  const tauxInteretDefaut = credit > 0 && credit <= 1200000 ? 2 : 5.5;
  const tauxInteret =
    financement.tauxInteret !== undefined && financement.tauxInteret !== null && financement.tauxInteret !== ""
      ? add("tauxInteret", num(financement.tauxInteret, 5.5), SOURCE.SAISIE, tr(lang, {
          fr: "Taux saisi par l'utilisateur.",
          ar: "النسبة التي أدخلها المستخدم.",
          darija: "النسبة اللي حطيتي نتا.",
        }))
      : add("tauxInteret", tauxInteretDefaut, SOURCE.REFERENCE, tauxInteretDefaut === 2
          ? tr(lang, {
              fr: "Taux préférentiel usuel du programme INTELAKA (2%) retenu par défaut car le crédit demandé entre dans son plafond — à confirmer avec la banque.",
              ar: "تم اعتماد النسبة التفضيلية المعتادة لبرنامج إنطلاقة (2%) بشكل افتراضي لأن القرض المطلوب يدخل ضمن سقفه — يجب التأكد منها مع البنك.",
              darija: "تخدمنا بالنسبة التفضيلية ديال برنامج إنطلاقة (2%) حيت القرض اللي طلبتي داخل فالسقف ديالو — خاصك تتأكد منها مع البنك.",
            })
          : tr(lang, {
              fr: "Taux bancaire classique usuel au Maroc (5,5%) retenu par défaut — à confirmer avec la banque.",
              ar: "تم اعتماد النسبة البنكية العادية المعتمدة بالمغرب (5.5%) بشكل افتراضي — يجب التأكد منها مع البنك.",
              darija: "تخدمنا بالنسبة البنكية العادية فالمغرب (5.5%) — خاصك تتأكد منها مع البنك.",
            }));

  const delaiClients =
    previ.delaiPaiementClients !== undefined && previ.delaiPaiementClients !== null && previ.delaiPaiementClients !== ""
      ? add("delaiClients", num(previ.delaiPaiementClients), SOURCE.SAISIE, tr(lang, {
          fr: "Délai saisi par l'utilisateur.",
          ar: "الأجل الذي أدخله المستخدم.",
          darija: "المدة اللي حطيتي نتا.",
        }))
      : add("delaiClients", DELAI_CLIENTS_DEFAUT[secteur] ?? 45, SOURCE.REFERENCE, tr(lang, {
          fr: `Valeur usuelle pour le secteur ${secteur}.`,
          ar: `قيمة معتادة بالنسبة لقطاع ${secteur}.`,
          darija: `قيمة عادية بالنسبة لقطاع ${secteur}.`,
        }));

  const delaiFourn =
    previ.delaiPaiementFournisseurs !== undefined && previ.delaiPaiementFournisseurs !== null && previ.delaiPaiementFournisseurs !== ""
      ? add("delaiFourn", num(previ.delaiPaiementFournisseurs), SOURCE.SAISIE, tr(lang, {
          fr: "Délai saisi par l'utilisateur.",
          ar: "الأجل الذي أدخله المستخدم.",
          darija: "المدة اللي حطيتي نتا.",
        }))
      : add("delaiFourn", DELAI_FOURNISSEURS_DEFAUT[secteur] ?? 45, SOURCE.REFERENCE, tr(lang, {
          fr: `Valeur usuelle pour le secteur ${secteur}.`,
          ar: `قيمة معتادة بالنسبة لقطاع ${secteur}.`,
          darija: `قيمة عادية بالنسبة لقطاع ${secteur}.`,
        }));

  const stockJours =
    previ.stockMoyenJours !== undefined && previ.stockMoyenJours !== null && previ.stockMoyenJours !== ""
      ? add("stockJours", num(previ.stockMoyenJours), SOURCE.SAISIE, tr(lang, {
          fr: "Valeur saisie par l'utilisateur.",
          ar: "القيمة التي أدخلها المستخدم.",
          darija: "القيمة اللي حطيتي نتا.",
        }))
      : add("stockJours", STOCK_JOURS_DEFAUT[secteur] ?? 30, SOURCE.REFERENCE, tr(lang, {
          fr: `Valeur usuelle pour le secteur ${secteur}.`,
          ar: `قيمة معتادة بالنسبة لقطاع ${secteur}.`,
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
