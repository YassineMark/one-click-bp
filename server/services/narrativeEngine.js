import { fmtDH } from "../utils/i18n.js";

/**
 * Contenu narratif multilingue (fr / en / darija) du document Entrepreneur.
 * Centralisé ici pour que les générateurs Excel/PDF ne dupliquent pas (et ne
 * fassent pas diverger) le même discours métier. Les documents Banque/Aide
 * (toujours en français) utilisent uniquement les fonctions `*Fr` ou passent
 * lang="fr".
 */

export function genererScenarios(cpc) {
  return [
    { id: "prudent", coeffCA: 0.8, coeffCharges: 1.08 },
    { id: "realiste", coeffCA: 1.0, coeffCharges: 1.0 },
    { id: "optimiste", coeffCA: 1.2, coeffCharges: 0.96 },
  ].map((s) => {
    const caScn = cpc.ca[0] * s.coeffCA;
    const chargesScn = (cpc.ca[0] - cpc.resultatNet[0]) * s.coeffCharges;
    const rnScn = caScn - chargesScn;
    return { id: s.id, ca: caScn, rn: rnScn, marge: caScn > 0 ? (rnScn / caScn) * 100 : 0 };
  });
}

function pct(a, b) {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

export function genererResumeNarratif(formData, bp, lang) {
  const { inputs, cpc, eligibilites } = bp;
  const nomProjet = inputs.nomProjet;
  const secteur = inputs.secteur;
  const ville = inputs.ville;
  const formeJuridique = inputs.formeJuridique;
  const pctApport = pct(inputs.apport, inputs.investissements);
  const eligTexts = eligibilites.programmes.map((p) => ({ nom: p.nom, statut: p.statut }));

  if (lang === "en") {
    return [
      `${nomProjet} is a business creation project in the ${secteur} sector, based in ${ville}, under the ${formeJuridique} legal form.`,
      `Total investment required: ${fmtDH(inputs.investissements)}, financed by a personal contribution of ${fmtDH(inputs.apport)} (${pctApport}% of the investment) and a bank loan of ${fmtDH(inputs.credit)}.`,
      `Forecast revenue grows from ${fmtDH(cpc.ca[0])} in Year 1 to ${fmtDH(cpc.ca[2])} in Year 3, with an average annual growth rate of ${inputs.croissance}%.`,
      `Forecast net income: ${fmtDH(cpc.resultatNet[0])} (Year 1), ${fmtDH(cpc.resultatNet[1])} (Year 2), ${fmtDH(cpc.resultatNet[2])} (Year 3).`,
      ...eligTexts.map((e) =>
        e.statut === "eligible"
          ? `The project is eligible for the ${e.nom} program.`
          : e.statut === "zone_grise"
          ? `The project may become eligible for the ${e.nom} program once some additional information is completed (see the Eligibility section).`
          : `The project is not currently eligible for the ${e.nom} program based on the data provided.`
      ),
    ];
  }
  if (lang === "darija") {
    return [
      `${nomProjet} هو مشروع باش تتأسس بيه مقاولة فقطاع ${secteur}، كاين فمدينة ${ville}، وغادي يخدم بصيغة ${formeJuridique}.`,
      `الاستثمار الإجمالي المطلوب هو ${fmtDH(inputs.investissements)}، ممول بمساهمة شخصية ديال ${fmtDH(inputs.apport)} (${pctApport}% من الاستثمار) وقرض بنكي ديال ${fmtDH(inputs.credit)}.`,
      `رقم المعاملات المتوقع غادي يزيد من ${fmtDH(cpc.ca[0])} فالسنة الأولى حتى ${fmtDH(cpc.ca[2])} فالسنة الثالثة، بمعدل نمو سنوي ديال ${inputs.croissance}%.`,
      `الربح الصافي المتوقع: ${fmtDH(cpc.resultatNet[0])} (سنة 1)، ${fmtDH(cpc.resultatNet[1])} (سنة 2)، ${fmtDH(cpc.resultatNet[2])} (سنة 3).`,
      ...eligTexts.map((e) =>
        e.statut === "eligible"
          ? `المشروع مؤهل لبرنامج ${e.nom}.`
          : e.statut === "zone_grise"
          ? `المشروع يمكن يوصل للأهلية ديال برنامج ${e.nom} إلا كملات شي معطيات (شوف قسم الأهلية).`
          : `المشروع ماشي مؤهل دابا لبرنامج ${e.nom} حسب المعطيات اللي دخلتي.`
      ),
    ];
  }
  // fr (défaut)
  return [
    `${nomProjet} est un projet de création d'entreprise dans le secteur ${secteur}, implanté à ${ville}, sous la forme juridique ${formeJuridique}.`,
    `Investissement global requis : ${fmtDH(inputs.investissements)}, financé par un apport personnel de ${fmtDH(inputs.apport)} (${pctApport}% de l'investissement) et un crédit bancaire de ${fmtDH(inputs.credit)}.`,
    `Le chiffre d'affaires prévisionnel progresse de ${fmtDH(cpc.ca[0])} en Année 1 à ${fmtDH(cpc.ca[2])} en Année 3, avec une croissance annuelle moyenne de ${inputs.croissance}%.`,
    `Résultat net prévisionnel : ${fmtDH(cpc.resultatNet[0])} (Année 1), ${fmtDH(cpc.resultatNet[1])} (Année 2), ${fmtDH(cpc.resultatNet[2])} (Année 3).`,
    ...eligTexts.map((e) =>
      e.statut === "eligible"
        ? `Le projet est éligible au programme ${e.nom}.`
        : e.statut === "zone_grise"
        ? `Le projet est potentiellement éligible au programme ${e.nom} sous réserve de compléments (voir la section Éligibilité).`
        : `Le projet n'est pas éligible au programme ${e.nom} en l'état des données saisies.`
    ),
  ];
}

const CONSEILS_SECTORIELS_FR = {
  Commerce: [
    "Le secteur du commerce impose souvent des paiements fournisseurs rapides (30-45 jours) alors que certains clients (grossistes, GMS) demandent des délais plus longs. Surveillez votre rotation de stock pour éviter une tension de trésorerie.",
    "Optimisez votre marge brute en tenant compte de la TVA à 20% applicable à la majorité des produits commercialisés.",
  ],
  Services: [
    "Les délais de paiement clients sont structurellement longs au Maroc (souvent 60 à 90 jours en B2B/administrations). Mettez en place un suivi rigoureux des relances.",
    "La majorité des prestations de services sont soumises à la TVA à 20% : veillez à bien la répercuter dans vos devis.",
  ],
  Industrie: [
    "L'industrie nécessite généralement un stock de matières premières et produits finis important : négociez des délais fournisseurs alignés sur votre cycle de production.",
    "Anticipez le coût employeur réel (environ +20% sur le salaire brut, CNSS/AMO) dans votre masse salariale prévisionnelle.",
  ],
  Agriculture: [
    "Le secteur agricole bénéficie d'exonérations significatives (IS et TVA selon le chiffre d'affaires) : vérifiez votre éligibilité au régime applicable.",
    "Votre activité étant saisonnière, constituez une réserve de trésorerie suffisante pour les périodes creuses.",
  ],
};

export function genererConseilsEntrepreneur(formData, bp, lang) {
  const { inputs } = bp;
  const conseilsFr = [
    `Identifiant Commun de l'Entreprise (ICE) : pensez à l'obtenir auprès de l'OMPIC dès la création, indispensable pour la facturation et les déclarations fiscales à ${inputs.ville}.`,
    "Taxe Professionnelle : une nouvelle entreprise bénéficie généralement d'une exonération de 5 ans sur les nouvelles installations. Anticipez son impact à partir de l'année 6.",
    ...(CONSEILS_SECTORIELS_FR[inputs.secteur] || []),
    inputs.formeJuridique === "Auto-entrepreneur"
      ? "Régime Auto-Entrepreneur : impôt forfaitaire de 1% à 2% du CA selon le secteur, mais attention au plafond de CA annuel (500 000 DH commerce/industrie, 200 000 DH services)."
      : `Comptabilité & obligations légales : en tant que ${inputs.formeJuridique}, une comptabilité normalisée (CGNC) et le dépôt des états de synthèse annuels auprès de la DGI sont obligatoires.`,
  ];
  if (lang === "fr") return conseilsFr;

  // Pour en/darija : traduction fidèle du même contenu (pas de nouvelle information inventée).
  const dict = {
    en: [
      `Common Business Identifier (ICE): remember to obtain it from OMPIC as soon as the company is created — it is required for invoicing and tax filings in ${inputs.ville}.`,
      "Professional Tax: a new business generally benefits from a 5-year exemption on new installations. Anticipate its impact starting from year 6.",
      ...(inputs.secteur === "Commerce"
        ? ["The retail sector often requires fast supplier payments (30-45 days) while some customers (wholesalers, large retailers) request longer terms. Monitor your stock turnover to avoid cash flow strain.", "Optimize your gross margin taking into account the 20% VAT applicable to most retailed products."]
        : inputs.secteur === "Services"
        ? ["Customer payment terms are structurally long in Morocco (often 60 to 90 days for B2B/public administration). Set up rigorous follow-up on outstanding payments.", "Most services are subject to 20% VAT: make sure to reflect it properly in your quotes and contracts."]
        : inputs.secteur === "Industrie"
        ? ["Industry generally requires a significant stock of raw materials and finished goods: negotiate supplier terms aligned with your production cycle.", "Anticipate the real employer cost (about +20% on gross salary, CNSS/AMO) in your projected payroll."]
        : ["The agricultural sector benefits from significant exemptions (corporate tax and VAT depending on revenue): check your eligibility for the applicable regime.", "Since your activity is seasonal, build up a sufficient cash reserve to cover slow periods."]),
      inputs.formeJuridique === "Auto-entrepreneur"
        ? "Self-employed regime: flat tax of 1% to 2% of revenue depending on the sector, but watch the annual revenue cap (500,000 DH for trade/industry, 200,000 DH for services)."
        : `Accounting & legal obligations: as a ${inputs.formeJuridique}, standardized accounting (CGNC) and filing annual financial statements with the DGI are mandatory.`,
    ],
    darija: [
      `المعرف الموحد ديال المقاولة (ICE) : خاصك تجيبو من OMPIC من ساعة التأسيس، ضروري باش تفاتوري وتصرح للضرائب فـ${inputs.ville}.`,
      "الضريبة المهنية : المقاولة الجديدة كتستافد غالباً من إعفاء ديال 5 سنين على التجهيزات الجديدة. خاصك تتوقع تأثيرها بداية من السنة 6.",
      ...(inputs.secteur === "Commerce"
        ? ["قطاع التجارة كيفرض غالباً آجال أداء سريعة للموردين (30-45 يوم) وبعض الزبناء كيطلبو آجال أطول. راقب دوران المخزون باش تتفادى ضغط على الخزينة.", "حسّن الهامش ديالك وخد بعين الاعتبار الضريبة بنسبة 20% اللي مطبقة على أغلب المنتوجات."]
        : inputs.secteur === "Services"
        ? ["آجال أداء الزبناء طويلين بزاف بالمغرب (غالباً 60 لـ90 يوم). دير متابعة صارمة للتحصيل.", "أغلب الخدمات خاضعة للضريبة بـ20% : تأكد تحسبها فعروض الأثمنة ديالك."]
        : inputs.secteur === "Industrie"
        ? ["الصناعة كتطلب مخزون مهم ديال المواد الأولية. تفاوض على آجال موردين كيوافقو دورة الإنتاج ديالك.", "توقع التكلفة الحقيقية ديال الأجر (+20% تقريباً بسبب CNSS/AMO)."]
        : ["القطاع الفلاحي كيستافد من إعفاءات مهمة. تأكد من الأهلية ديالك.", "الأنشطة الفلاحية موسمية، دير احتياطي كافي ديال الفلوس للفترات الضعيفة."]),
      inputs.formeJuridique === "Auto-entrepreneur"
        ? "نظام المقاول الذاتي : ضريبة جزافية من 1% لـ2% من رقم المعاملات، وانتبه لسقف رقم الأعمال السنوي (500.000 درهم تجارة/صناعة، 200.000 درهم خدمات)."
        : `المحاسبة والالتزامات القانونية : بصفتك ${inputs.formeJuridique}، خاصك محاسبة منتظمة وإيداع الحسابات السنوية عند الضرائب.`,
    ],
  };
  return dict[lang] || conseilsFr;
}

export const GUIDE_PEDAGOGIQUE = {
  fr: {
    intro: "Ce document présente votre Business Plan sous une forme conçue pour être comprise même sans connaissances préalables en gestion, comptabilité ou finance.",
    commentLire: [
      "Chaque onglet correspond à un thème : commencez par le Résumé, puis parcourez les onglets dans l'ordre.",
      "Les montants sont toujours exprimés en Dirhams marocains (DH), sauf indication contraire.",
      "Les cellules en gras et en couleur représentent des totaux ou des résultats clés.",
      "L'onglet Hypothèses indique, pour chaque chiffre important, s'il provient de votre saisie, d'un calcul automatique, ou d'une estimation de référence.",
    ],
    glossaire: [
      { terme: "Chiffre d'affaires (CA)", def: "Total des ventes réalisées, avant déduction des charges." },
      { terme: "Charges", def: "Ensemble des dépenses nécessaires au fonctionnement de l'entreprise." },
      { terme: "Résultat net", def: "Ce qu'il reste une fois toutes les charges et impôts payés : le bénéfice (ou la perte) réel." },
      { terme: "Trésorerie", def: "L'argent réellement disponible sur le compte bancaire de l'entreprise à un instant donné." },
      { terme: "Besoin en fonds de roulement (BFR)", def: "L'argent qu'il faut avancer avant d'être payé par ses clients." },
      { terme: "Seuil de rentabilité", def: "Le chiffre d'affaires minimum à réaliser pour ne pas perdre d'argent." },
      { terme: "Capacité d'autofinancement (CAF)", def: "L'argent que l'entreprise génère elle-même et qui peut servir à rembourser un crédit ou réinvestir." },
    ],
    conseils: [
      "Ne considérez jamais un chiffre de ce document comme définitif : ce sont des prévisions à ajuster avec l'expérience.",
      "Montrez ce document à un professionnel (expert-comptable, conseiller bancaire) avant toute décision importante.",
    ],
    erreurs: [
      "Confondre chiffre d'affaires et bénéfice.",
      "Oublier de provisionner la trésorerie pour les périodes creuses.",
      "Sous-estimer les charges sociales patronales (CNSS/AMO).",
    ],
  },
  en: {
    intro: "This document presents your Business Plan in a form designed to be understood even without prior knowledge of management, accounting, or finance.",
    commentLire: [
      "Each tab covers one theme: start with the Summary, then go through the tabs in order.",
      "Amounts are always expressed in Moroccan Dirhams (DH) unless otherwise stated.",
      "Bold, colored cells represent totals or key results.",
      "The Assumptions tab shows, for each important figure, whether it comes from your own input, an automatic calculation, or a reference estimate.",
    ],
    glossaire: [
      { terme: "Revenue (turnover)", def: "Total sales achieved, before deducting expenses." },
      { terme: "Expenses", def: "All the spending needed to run the business." },
      { terme: "Net income", def: "What remains once all expenses and taxes are paid: the real profit (or loss)." },
      { terme: "Cash", def: "The money actually available in the business's bank account at a given moment." },
      { terme: "Working capital requirement (WCR)", def: "The money you need to advance before your customers pay you." },
      { terme: "Break-even point", def: "The minimum revenue you need to achieve to avoid losing money." },
      { terme: "Self-financing capacity", def: "The money the business generates on its own, which can be used to repay a loan or reinvest." },
    ],
    conseils: ["Never treat a figure in this document as final: these are forecasts to be adjusted with experience.", "Show this document to a professional (chartered accountant, bank advisor) before any major decision."],
    erreurs: ["Confusing revenue with profit.", "Forgetting to set aside cash for slow periods.", "Underestimating employer social contributions (CNSS/AMO)."],
  },
  darija: {
    intro: "هاد الوثيقة كتعرض مخطط الأعمال ديالكم بطريقة سهلة، يمكن تفهموها حتى إلا ما عندكمش معرفة قبلية بالتدبير أو المحاسبة.",
    commentLire: [
      "كل ورقة عندها موضوع خاص بيها : بدا بالملخص، من بعد تصفح الأوراق بالترتيب.",
      "المبالغ ديما بالدرهم المغربي (DH) إلا ما قلناش العكس.",
      "الخانات الغامقة والملونة هي مجاميع أو نتائج مهمة.",
      "ورقة الفرضيات كتبين، لكل رقم مهم، واش هو معطى دخلتيه نتا، ولا محسوب أوتوماتيكياً، ولا تقدير مرجعي.",
    ],
    glossaire: [
      { terme: "رقم المعاملات", def: "مجموع البيع اللي تم، قبل ما نطرحو التكاليف." },
      { terme: "المصاريف", def: "كل لي خاص المقاولة تصرفو باش تخدم." },
      { terme: "الربح الصافي", def: "لي كيبقى من بعد ما تخلص كل المصاريف والضرائب." },
      { terme: "الخزينة", def: "الفلوس اللي كاينة بصح فالحساب البنكي ديال المقاولة." },
      { terme: "الحاجة لرأس المال العامل", def: "الفلوس اللي خاصك تسبق قبل ما يخلصوك الزبناء." },
      { terme: "عتبة الربحية", def: "الحد الأدنى ديال رقم المعاملات باش ما تخسرش." },
      { terme: "القدرة على التمويل الذاتي", def: "الفلوس اللي كتخلق المقاولة بنفسها وتقدر تخدم بيهم تسديد قرض أو استثمار جديد." },
    ],
    conseils: ["ما تديرش شي رقم فهاد الوثيقة كأنه نهائي : غير توقعات خاصها تتصحح مع التجربة.", "وري هاد الوثيقة لمختص (خبير محاسب، مستشار بنكي) قبل أي قرار مهم."],
    erreurs: ["الخلط بين رقم المعاملات والربح.", "ننسا نحطو احتياطي ديال الخزينة للفترات الضعيفة.", "نستهينو بالتحملات الاجتماعية (CNSS/AMO)."],
  },
};
