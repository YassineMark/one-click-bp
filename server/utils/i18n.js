/**
 * Traductions pour le document Entrepreneur (fr / ar = arabe standard / darija).
 * Les documents Banque et Aides restent TOUJOURS en français (voir
 * pdfBuilder/excelBuilder correspondants) : ce fichier ne les concerne pas.
 */
export function fmtDH(n) {
  if (n === null || n === undefined || isNaN(n)) return "0 DH";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(Math.round(n));
  return sign + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " DH";
}

export const I18N = {
  fr: {
    dirRTL: false,
    langueLabel: "Français",
    titreBP: "BUSINESS PLAN",
    sousTitre: "Document pédagogique à destination de l'entrepreneur",
    guide: "Guide de lecture",
    resume: "Résumé du projet",
    hypotheses: "Hypothèses",
    marche: "Marché", clients: "Clients", produits: "Produits / Services",
    strategieCommerciale: "Stratégie commerciale", marketing: "Marketing",
    rh: "Ressources humaines", investissement: "Investissement", financement: "Financement",
    caPrevisionnel: "Chiffre d'affaires prévisionnel", charges: "Charges",
    cpc: "Compte de résultat prévisionnel", tresorerie: "Trésorerie", bfr: "Besoin en fonds de roulement",
    seuilRentabilite: "Seuil de rentabilité", analyseFinanciere: "Analyse financière",
    scenarios: "Scénarios", conseils: "Conseils stratégiques",
    annee: "Année", rubrique: "Rubrique", montant: "Montant (DH)", num: "N°",
    prudent: "Prudent", realiste: "Réaliste", optimiste: "Optimiste",
    ok: "OUI", non: "NON", source: "Source",
    sourceSaisie: "Saisie utilisateur", sourceCalculee: "Hypothèse calculée", sourceReference: "Hypothèse de référence",
    avertissement: "Document généré automatiquement par One Click BP. Les hypothèses et barèmes fiscaux sont indicatifs et doivent être validés avec un expert-comptable agréé.",
  },
  ar: {
    dirRTL: true,
    langueLabel: "العربية",
    titreBP: "مخطط الأعمال (Business Plan)",
    sousTitre: "وثيقة تعليمية موجهة لصاحب المشروع",
    guide: "دليل القراءة",
    resume: "ملخص المشروع",
    hypotheses: "الفرضيات",
    marche: "السوق", clients: "الزبناء", produits: "المنتجات / الخدمات",
    strategieCommerciale: "الاستراتيجية التجارية", marketing: "التسويق",
    rh: "الموارد البشرية", investissement: "الاستثمار", financement: "التمويل",
    caPrevisionnel: "رقم الأعمال التوقعي", charges: "التكاليف",
    cpc: "حساب النتائج التوقعي", tresorerie: "الخزينة", bfr: "الحاجة إلى رأس المال العامل",
    seuilRentabilite: "عتبة الربحية", analyseFinanciere: "التحليل المالي",
    scenarios: "السيناريوهات", conseils: "نصائح استراتيجية",
    annee: "السنة", rubrique: "البند", montant: "المبلغ (درهم)", num: "رقم",
    prudent: "متحفظ", realiste: "واقعي", optimiste: "متفائل",
    ok: "نعم", non: "لا", source: "المصدر",
    sourceSaisie: "معطى من طرف المستخدم", sourceCalculee: "فرضية محسوبة", sourceReference: "فرضية مرجعية",
    avertissement: "وثيقة تم إنشاؤها تلقائياً بواسطة One Click BP. الفرضيات والجداول الضريبية إرشادية ويجب التحقق منها مع خبير محاسب معتمد.",
  },
  darija: {
    dirRTL: true,
    langueLabel: "الدارجة",
    titreBP: "مخطط الأعمال (Business Plan)",
    sousTitre: "وثيقة بسيطة لصاحب المشروع",
    guide: "دليل القراءة",
    resume: "ملخص المشروع",
    hypotheses: "الفرضيات",
    marche: "السوق", clients: "الزبناء", produits: "المنتوجات / الخدمات",
    strategieCommerciale: "الاستراتيجية التجارية", marketing: "التسويق",
    rh: "الموارد البشرية", investissement: "الاستثمار", financement: "التمويل",
    caPrevisionnel: "رقم المعاملات المتوقع", charges: "المصاريف",
    cpc: "حساب النتائج المتوقع", tresorerie: "الخزينة", bfr: "الحاجة لرأس المال العامل",
    seuilRentabilite: "نقطة التعادل", analyseFinanciere: "التحليل المالي",
    scenarios: "السيناريوهات", conseils: "نصائح",
    annee: "السنة", rubrique: "البند", montant: "المبلغ (درهم)", num: "رقم",
    prudent: "متحفظ", realiste: "واقعي", optimiste: "متفائل",
    ok: "ايه", non: "لا", source: "مصدر المعطى",
    sourceSaisie: "دخلها المستخدم", sourceCalculee: "فرضية محسوبة", sourceReference: "فرضية مرجعية",
    avertissement: "هاد الوثيقة تصاوبات بشكل أوتوماتيكي من طرف One Click BP. الفرضيات والجداول الضريبية للاستئناس فقط، خاصك تتأكد منهم مع خبير محاسب معتمد.",
  },
};

export function labelSource(lang, source) {
  const t = I18N[lang] || I18N.fr;
  if (source === "saisie_utilisateur") return t.sourceSaisie;
  if (source === "hypothese_calculee") return t.sourceCalculee;
  return t.sourceReference;
}

// Traduction des libellés de lignes de tableaux financiers (CPC/SIG/Bilan...),
// clé = libellé français source tel que généré par financialEngine.js.
export const LIGNES_TR = {
  fr: {},
  ar: {
    "Chiffre d'Affaires (HT)": "رقم الأعمال (دون احتساب الضريبة)",
    "Achats consommés": "المشتريات المستهلكة",
    "Charges externes": "التكاليف الخارجية",
    "Impôts & taxes": "الضرائب والرسوم",
    "Charges de personnel": "أجور المستخدمين",
    "Dotations aux amortissements": "مخصصات الاستهلاك",
    "Total Charges d'Exploitation": "مجموع تكاليف الاستغلال",
    "Résultat d'Exploitation": "نتيجة الاستغلال",
    "Charges financières (intérêts)": "التكاليف المالية (الفوائد)",
    "Résultat Courant Avant Impôt": "النتيجة الجارية قبل الضريبة",
    "Impôt (IS/IR)": "الضريبة على الشركات / الدخل",
    "Résultat Net": "الربح الصافي",
    "TOTAL ACTIF": "مجموع الأصول", "TOTAL PASSIF": "مجموع الخصوم",
    "Immobilisations nettes": "الأصول الثابتة الصافية",
    "Actif circulant (estimé)": "الأصول المتداولة (تقديري)",
    "Trésorerie (estimée)": "الخزينة (تقديري)",
    "Capitaux Propres (cumulés)": "الأموال الذاتية (تراكمي)",
    "Dettes de financement (crédit restant)": "ديون التمويل (المتبقي)",
    "Passif circulant (estimé)": "الخصوم المتداولة (تقديري)",
  },
  darija: {
    "Chiffre d'Affaires (HT)": "رقم المعاملات (بلا الضريبة)",
    "Achats consommés": "المشتريات",
    "Charges externes": "المصاريف الخارجية",
    "Impôts & taxes": "الضرائب",
    "Charges de personnel": "أجور الخدامة",
    "Dotations aux amortissements": "الاستهلاك",
    "Total Charges d'Exploitation": "مجموع مصاريف الاستغلال",
    "Résultat d'Exploitation": "نتيجة الاستغلال",
    "Charges financières (intérêts)": "الفوائد البنكية",
    "Résultat Courant Avant Impôt": "النتيجة قبل الضريبة",
    "Impôt (IS/IR)": "الضريبة",
    "Résultat Net": "الربح الصافي",
    "TOTAL ACTIF": "مجموع لي كاين", "TOTAL PASSIF": "مجموع الديون والأموال",
    "Immobilisations nettes": "التجهيزات الصافية",
    "Actif circulant (estimé)": "لي كاين المتداول (تقديري)",
    "Trésorerie (estimée)": "الفلوس (تقديري)",
    "Capitaux Propres (cumulés)": "الفلوس ديال صاحب المشروع",
    "Dettes de financement (crédit restant)": "لي بقا من القرض",
    "Passif circulant (estimé)": "الديون قصيرة المدى (تقديري)",
  },
};

export function trLigne(label, lang) {
  const clean = label.replace(/&amp;/g, "&");
  if (lang === "fr") return clean;
  return (LIGNES_TR[lang] && LIGNES_TR[lang][clean]) || clean;
}

export function anneeLabel(lang, i) {
  const t = I18N[lang] || I18N.fr;
  return `${t.annee} ${i + 1}`;
}
