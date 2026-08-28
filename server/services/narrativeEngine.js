import { fmtDH } from "../utils/i18n.js";

/**
 * Contenu narratif multilingue (fr / ar / darija) du document Entrepreneur.
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

  if (lang === "ar") {
    return [
      `${nomProjet} هو مشروع لإنشاء مقاولة في قطاع ${secteur}، يقع في مدينة ${ville}، ويعتمد الشكل القانوني ${formeJuridique}.`,
      `يتطلب المشروع استثماراً إجمالياً قدره ${fmtDH(inputs.investissements)}، يُموَّل بمساهمة شخصية قدرها ${fmtDH(inputs.apport)} (أي ${pctApport}% من الاستثمار) وقرض بنكي قدره ${fmtDH(inputs.credit)}.`,
      `يرتفع رقم الأعمال المتوقع من ${fmtDH(cpc.ca[0])} في السنة الأولى إلى ${fmtDH(cpc.ca[2])} في السنة الثالثة، بمعدل نمو سنوي قدره ${inputs.croissance}%.`,
      `الربح الصافي المتوقع: ${fmtDH(cpc.resultatNet[0])} (السنة 1)، ${fmtDH(cpc.resultatNet[1])} (السنة 2)، ${fmtDH(cpc.resultatNet[2])} (السنة 3).`,
      ...eligTexts.map((e) =>
        e.statut === "eligible"
          ? `المشروع مؤهل لبرنامج ${e.nom}.`
          : e.statut === "zone_grise"
          ? `المشروع قد يكون مؤهلاً لبرنامج ${e.nom} بعد استكمال بعض المعطيات (انظر قسم الأهلية).`
          : `المشروع غير مؤهل حالياً لبرنامج ${e.nom} حسب المعطيات المدخلة.`
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

  // Pour ar/darija : traduction fidèle du même contenu (pas de nouvelle information inventée).
  const dict = {
    ar: [
      `المعرف الموحد للمقاولة (ICE) : يجب الحصول عليه من المكتب المغربي للملكية الصناعية والتجارية (OMPIC) منذ التأسيس، وهو ضروري للفوترة والتصريحات الضريبية في ${inputs.ville}.`,
      "الضريبة المهنية : تستفيد المقاولة الجديدة عادة من إعفاء لمدة 5 سنوات على التجهيزات الجديدة. يجب توقع أثرها ابتداءً من السنة السادسة.",
      ...(inputs.secteur === "Commerce"
        ? ["قطاع التجارة يفرض غالباً آجال أداء سريعة للموردين (30-45 يوماً) بينما بعض الزبناء يطلبون آجالاً أطول. راقب دوران المخزون لتفادي ضغط على الخزينة.", "حسّن هامشك الإجمالي مع الأخذ بعين الاعتبار الضريبة على القيمة المضافة بنسبة 20% المطبقة على أغلب المنتجات."]
        : inputs.secteur === "Services"
        ? ["آجال أداء الزبناء طويلة هيكلياً بالمغرب (غالباً 60 إلى 90 يوماً). ضع نظاماً صارماً لمتابعة التحصيل.", "أغلب الخدمات خاضعة للضريبة على القيمة المضافة بنسبة 20% : تأكد من احتسابها في عروض أسعارك."]
        : inputs.secteur === "Industrie"
        ? ["الصناعة تتطلب عادة مخزوناً مهماً من المواد الأولية والمنتجات التامة : تفاوض على آجال موردين متلائمة مع دورة الإنتاج.", "توقع التكلفة الحقيقية للأجر (حوالي +20% بسبب CNSS/AMO) في كتلتك الأجرية التوقعية."]
        : ["يستفيد القطاع الفلاحي من إعفاءات مهمة حسب رقم الأعمال. تحقق من أهليتك للنظام المطبق.", "نظراً لموسمية النشاط، كوّن احتياطياً كافياً من الخزينة لتغطية الفترات الضعيفة."]),
      inputs.formeJuridique === "Auto-entrepreneur"
        ? "نظام المقاول الذاتي : ضريبة جزافية من 1% إلى 2% من رقم الأعمال حسب القطاع، مع الانتباه لسقف رقم الأعمال السنوي (500.000 درهم للتجارة/الصناعة، 200.000 درهم للخدمات)."
        : `المحاسبة والالتزامات القانونية : بصفتكم ${inputs.formeJuridique}، محاسبة منتظمة وفق المدونة العامة للتوحيد المحاسبي وإيداع الحسابات السنوية لدى المديرية العامة للضرائب إلزاميان.`,
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
  ar: {
    intro: "تعرض هذه الوثيقة مخطط أعمالكم بطريقة مبسطة يمكن فهمها حتى بدون معرفة مسبقة بالتدبير أو المحاسبة أو المالية.",
    commentLire: [
      "كل ورقة تتعلق بموضوع معين : ابدأ بالملخص، ثم تصفح الأوراق بالترتيب.",
      "المبالغ معبر عنها دائماً بالدرهم المغربي (DH) ما لم يُذكر خلاف ذلك.",
      "الخلايا الغامقة الملونة تمثل مجاميع أو نتائج أساسية.",
      "ورقة الفرضيات توضح، لكل رقم مهم، إن كان معطى أدخلتموه أو محسوباً تلقائياً أو تقديراً مرجعياً.",
    ],
    glossaire: [
      { terme: "رقم الأعمال", def: "مجموع المبيعات المحققة، قبل خصم التكاليف." },
      { terme: "التكاليف", def: "مجموع المصاريف الضرورية لتسيير المقاولة." },
      { terme: "الربح الصافي", def: "ما يتبقى بعد أداء جميع التكاليف والضرائب : الربح (أو الخسارة) الحقيقي." },
      { terme: "الخزينة", def: "المال المتوفر فعلياً في الحساب البنكي للمقاولة في لحظة معينة." },
      { terme: "الحاجة لرأس المال العامل", def: "المال الذي يجب تسبيقه قبل التوصل بأداء الزبناء." },
      { terme: "عتبة الربحية", def: "الحد الأدنى لرقم الأعمال الواجب تحقيقه لتجنب الخسارة." },
      { terme: "القدرة على التمويل الذاتي", def: "المال الذي تولده المقاولة بنفسها ويمكن استعماله لتسديد قرض أو إعادة الاستثمار." },
    ],
    conseils: ["لا تعتبروا أبداً رقماً في هذه الوثيقة نهائياً : إنها توقعات يجب تعديلها مع التجربة.", "اعرضوا هذه الوثيقة على مختص (خبير محاسب، مستشار بنكي) قبل أي قرار مهم."],
    erreurs: ["الخلط بين رقم الأعمال والربح.", "نسيان تخصيص خزينة احتياطية للفترات الضعيفة.", "التقليل من قيمة التحملات الاجتماعية للمشغل (CNSS/AMO)."],
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
