import ExcelJS from "exceljs";
import { fmtDH, I18N, labelSource, trLigne, anneeLabel } from "../../utils/i18n.js";
import {
  genererScenarios,
  genererResumeNarratif,
  genererConseilsEntrepreneur,
  GUIDE_PEDAGOGIQUE,
} from "../narrativeEngine.js";

/**
 * Génère le classeur Excel "Business Plan Entrepreneur" (20 onglets),
 * dans la langue choisie par l'utilisateur (fr / en / darija).
 *
 * Règle d'or : ce fichier ne fait AUCUN calcul métier et n'invente AUCUN
 * chiffre — il ne fait que mettre en forme les données déjà calculées par
 * analysisService.js / financialEngine.js / hypothesisEngine.js (`bp`) et
 * les réponses brutes du formulaire (`formData`). Les seules formules
 * ajoutées ici sont des formules Excel natives (SUM, multiplications) qui
 * recalculent, à l'identique, des totaux déjà connus — jamais de nouvelles
 * hypothèses.
 */

// ---------------------------------------------------------------------------
// Constantes de style
// ---------------------------------------------------------------------------
const NAVY = "FF0B2545";
const WHITE = "FFFFFFFF";
const EMERALD = "FF0F9D58";
const LIGHT_FILL = "FFF2F6FA";

const CURRENCY_FMT = '#,##0" DH"';
const PCT_FMT = '0.0"%"';
const X_FMT = '0.00"x"';
const INT_FMT = "#,##0";

const FOOTER = {
  fr: "One Click BP — document généré automatiquement, hypothèses à valider avec un expert-comptable agréé.",
  en: "One Click BP — automatically generated document, assumptions to be validated with a chartered accountant.",
  darija: "One Click BP — هاد الوثيقة تصاوبات أوتوماتيكياً، خاصك تتأكد من الفرضيات مع خبير محاسب معتمد.",
};

// ---------------------------------------------------------------------------
// Dictionnaire local de libellés structurels (en plus de I18N/i18n.js).
// Les DONNÉES saisies par l'utilisateur (texte libre, options du formulaire)
// ne sont jamais retraduites : seuls les libellés de colonnes/lignes le sont.
// ---------------------------------------------------------------------------
const T = {
  fr: {
    champCol: "Champ", valeurCol: "Valeur", explicationCol: "Explication",
    guideIntroTitle: "Introduction", guideCommentLireTitle: "Comment lire ce document ?",
    guideGlossaireTitle: "Glossaire", guideConseilsTitle: "Conseils",
    guideErreursTitle: "Erreurs fréquentes à éviter",
    termeCol: "Terme", definitionCol: "Définition",
    identiteTitle: "Identité du projet", nomProjetLbl: "Nom du projet",
    secteurLbl: "Secteur d'activité", villeLbl: "Ville", formeJuridiqueLbl: "Forme juridique",
    resumeNarratifTitle: "Résumé narratif",
    marche_ville: "Ville cible principale", marche_region: "Région",
    marche_portee: "Portée du marché", marche_clientele: "Clientèle visée",
    marche_type: "Type de marché", marche_taille: "Taille estimée du marché (DH/an)",
    marche_tendances: "Tendances observées dans le secteur", marche_saisonnalite: "Secteur saisonnier ?",
    marche_facteurs: "Principaux facteurs influençant la demande",
    clients_profil: "Profil type du client", clients_age: "Tranche d'âge cible",
    clients_localisation: "Localisation des clients", clients_pouvoirAchat: "Pouvoir d'achat de la cible",
    clients_besoins: "Principaux besoins des clients", clients_frequence: "Fréquence d'achat estimée",
    clients_panier: "Panier moyen estimé", clients_nbClients: "Nombre de clients prévu (Année 1)",
    clients_croissance: "Croissance du nombre de clients (%/an)", clients_methode: "Méthode d'acquisition des clients",
    produits_nom: "Nom", produits_description: "Description", produits_prix: "Prix de vente unitaire",
    produits_cout: "Coût direct unitaire", produits_qte: "Quantité vendue / mois",
    produits_freq: "Mois vendus / an", produits_marge: "Marge souhaitée (%)", produits_ca: "CA annuel",
    totalLbl: "TOTAL", produits_aucun: "Aucun produit / service détaillé n'a été saisi dans le formulaire.",
    concurrence_question: "Des concurrents ont-ils été identifiés ?",
    concurrence_nom: "Nom", concurrence_prix: "Prix pratiqués", concurrence_avantages: "Avantages",
    concurrence_faiblesses: "Faiblesses", concurrence_positionnement: "Positionnement souhaité",
    concurrence_avantageConcurrentiel: "Avantage concurrentiel mis en avant",
    concurrence_aucun: "Aucun concurrent n'a encore été identifié par le porteur de projet. Il est recommandé d'effectuer une étude de terrain avant de finaliser le positionnement commercial — ne pas se baser sur des concurrents fictifs.",
    marketing_methode: "Méthode d'acquisition envisagée (issue de la section Clients)",
    marketing_conseilsTitle: "Bonnes pratiques marketing pour le marché marocain",
    marketing_tips: [
      "Présence digitale : page Facebook/Instagram et fiche Google Business pour être visible localement.",
      "WhatsApp Business : communiquer avec les clients, prendre des commandes et envoyer des rappels de rendez-vous.",
      "Partenariats locaux : commerçants, associations ou prescripteurs du quartier pour gagner en visibilité à moindre coût.",
      "Bouche-à-oreille et avis clients : à encourager activement (programme de parrainage, demande d'avis en ligne).",
    ],
    rh_poste: "Poste", rh_nombre: "Nombre", rh_salaire: "Salaire brut mensuel",
    rh_coutAnnuel: "Coût annuel employeur (estimé)", rh_date: "Date d'embauche prévue",
    rh_aucun: "Aucun poste détaillé n'a été saisi. La masse salariale retenue provient du montant global saisi à l'étape Charges (voir onglet Hypothèses).",
    invest_local: "Local (acquisition, pas de porte)", invest_travaux: "Travaux / aménagement",
    invest_equipement: "Équipement", invest_machines: "Machines", invest_informatique: "Matériel informatique",
    invest_mobilier: "Mobilier", invest_vehicule: "Véhicule", invest_logiciels: "Logiciels",
    invest_licences: "Licences / agréments", invest_stock: "Stock initial",
    invest_communication: "Communication de lancement", invest_frais: "Frais de création d'entreprise",
    invest_autres: "Autres investissements", invest_totalLbl: "TOTAL INVESTISSEMENT",
    posteCol: "Poste", montantCol: "Montant (DH)",
    financement_emplois: "Emplois (besoins)", financement_ressources: "Ressources (financement)",
    financement_surplus: "Vos ressources couvrent vos besoins, avec un excédent de",
    financement_deficit: "Vos ressources ne couvrent pas encore vos besoins : il manque",
    financement_deficitSuite: "à financer via un complément (apport, crédit ou subvention supplémentaire).",
    charges_loyer: "Loyer annuel", charges_electricite: "Électricité", charges_eau: "Eau",
    charges_internet: "Internet", charges_telecommunications: "Télécommunications",
    charges_marketing: "Marketing / communication", charges_transport: "Transport",
    charges_assurance: "Assurance", charges_comptabilite: "Comptabilité / expert-comptable",
    charges_logiciels: "Abonnements logiciels", charges_maintenance: "Maintenance / entretien",
    charges_matieresPremiere: "Matières premières / fournitures", charges_fraisBancaires: "Frais bancaires",
    charges_taxes: "Taxes diverses", charges_autres: "Autres charges", charges_salaires: "Salaires (non détaillés en RH)",
    charges_totalLbl: "TOTAL CHARGES SAISIES", charges_comparaisonTitle: "Charges du compte de résultat prévisionnel (pour comparaison)",
    treso_mois: "Mois", treso_encCA: "Encaissements CA (TTC)", treso_encFin: "Encaissements financement",
    treso_totEnc: "Total encaissements", treso_chgExt: "Décaissements charges externes",
    treso_chgPers: "Décaissements charges personnel", treso_invest: "Décaissements investissement",
    treso_tva: "TVA à payer", treso_totDec: "Total décaissements", treso_fluxNet: "Flux net du mois",
    treso_solde: "Solde de trésorerie cumulé", treso_graphTitle: "Évolution du solde cumulé (visualisation par barres de données)",
    bfr_montantLbl: "Besoin en Fonds de Roulement estimé", bfr_delaiClientsLbl: "Délai de paiement clients retenu",
    bfr_delaiFournLbl: "Délai de paiement fournisseurs retenu", bfr_stockJoursLbl: "Stock moyen retenu",
    bfr_joursUnit: "jours",
    seuil_montantLbl: "Chiffre d'affaires à atteindre (seuil de rentabilité)",
    seuil_joursLbl: "Nombre de jours pour atteindre ce seuil (Année 1)",
    seuil_atteintOui: "Ce seuil est atteignable dès la première année d'activité.",
    seuil_atteintNon: "Ce seuil ne serait pas atteint au cours de la première année selon les hypothèses actuelles.",
    seuil_nonCalculable: "Le seuil de rentabilité ne peut pas être calculé avec les données actuelles (marge sur coûts variables nulle ou négative).",
    ratios_infoCol: "Repère",
    scenario_caLbl: "Chiffre d'affaires (Année 1)", scenario_rnLbl: "Résultat net (Année 1)",
    scenario_margeLbl: "Marge nette",
  },
  en: {
    champCol: "Field", valeurCol: "Value", explicationCol: "Explanation",
    guideIntroTitle: "Introduction", guideCommentLireTitle: "How to read this document?",
    guideGlossaireTitle: "Glossary", guideConseilsTitle: "Tips",
    guideErreursTitle: "Common mistakes to avoid",
    termeCol: "Term", definitionCol: "Definition",
    identiteTitle: "Project identity", nomProjetLbl: "Project name",
    secteurLbl: "Business sector", villeLbl: "City", formeJuridiqueLbl: "Legal form",
    resumeNarratifTitle: "Narrative summary",
    marche_ville: "Main target city", marche_region: "Region",
    marche_portee: "Market scope", marche_clientele: "Target customers",
    marche_type: "Market type", marche_taille: "Estimated market size (DH/year)",
    marche_tendances: "Trends observed in the sector", marche_saisonnalite: "Seasonal sector?",
    marche_facteurs: "Main factors influencing demand",
    clients_profil: "Typical customer profile", clients_age: "Target age range",
    clients_localisation: "Customer location", clients_pouvoirAchat: "Target purchasing power",
    clients_besoins: "Main customer needs", clients_frequence: "Estimated purchase frequency",
    clients_panier: "Estimated average basket", clients_nbClients: "Expected number of customers (Year 1)",
    clients_croissance: "Customer growth rate (%/year)", clients_methode: "Customer acquisition method",
    produits_nom: "Name", produits_description: "Description", produits_prix: "Unit selling price",
    produits_cout: "Unit direct cost", produits_qte: "Quantity sold / month",
    produits_freq: "Months sold / year", produits_marge: "Desired margin (%)", produits_ca: "Annual revenue",
    totalLbl: "TOTAL", produits_aucun: "No detailed product/service was entered in the form.",
    concurrence_question: "Have any competitors been identified?",
    concurrence_nom: "Name", concurrence_prix: "Prices charged", concurrence_avantages: "Advantages",
    concurrence_faiblesses: "Weaknesses", concurrence_positionnement: "Desired positioning",
    concurrence_avantageConcurrentiel: "Highlighted competitive advantage",
    concurrence_aucun: "No competitor has yet been identified by the project owner. A field study is recommended before finalizing the commercial positioning — do not rely on fictional competitors.",
    marketing_methode: "Planned acquisition method (from the Customers section)",
    marketing_conseilsTitle: "Marketing best practices for the Moroccan market",
    marketing_tips: [
      "Digital presence: Facebook/Instagram page and Google Business listing to be visible locally.",
      "WhatsApp Business: communicate with customers, take orders, and send appointment reminders.",
      "Local partnerships: shopkeepers, associations, or local influencers to gain visibility at low cost.",
      "Word of mouth and customer reviews: actively encourage them (referral program, requesting online reviews).",
    ],
    rh_poste: "Position", rh_nombre: "Number", rh_salaire: "Monthly gross salary",
    rh_coutAnnuel: "Estimated annual employer cost", rh_date: "Planned hiring date",
    rh_aucun: "No detailed position was entered. The payroll used comes from the total amount entered in the Expenses step (see the Assumptions tab).",
    invest_local: "Premises (acquisition, key money)", invest_travaux: "Works / fit-out",
    invest_equipement: "Equipment", invest_machines: "Machines", invest_informatique: "IT equipment",
    invest_mobilier: "Furniture", invest_vehicule: "Vehicle", invest_logiciels: "Software",
    invest_licences: "Licenses / permits", invest_stock: "Initial stock",
    invest_communication: "Launch communication", invest_frais: "Company incorporation costs",
    invest_autres: "Other investments", invest_totalLbl: "TOTAL INVESTMENT",
    posteCol: "Item", montantCol: "Amount (DH)",
    financement_emplois: "Uses (needs)", financement_ressources: "Sources (financing)",
    financement_surplus: "Your resources cover your needs, with a surplus of",
    financement_deficit: "Your resources do not yet cover your needs: you are short by",
    financement_deficitSuite: "to be financed through an additional source (contribution, loan, or extra grant).",
    charges_loyer: "Annual rent", charges_electricite: "Electricity", charges_eau: "Water",
    charges_internet: "Internet", charges_telecommunications: "Telecommunications",
    charges_marketing: "Marketing / communication", charges_transport: "Transport",
    charges_assurance: "Insurance", charges_comptabilite: "Accounting / chartered accountant",
    charges_logiciels: "Software subscriptions", charges_maintenance: "Maintenance / upkeep",
    charges_matieresPremiere: "Raw materials / supplies", charges_fraisBancaires: "Bank fees",
    charges_taxes: "Various taxes", charges_autres: "Other expenses", charges_salaires: "Salaries (not detailed in HR)",
    charges_totalLbl: "TOTAL EXPENSES ENTERED", charges_comparaisonTitle: "Expenses from the forecast income statement (for comparison)",
    treso_mois: "Month", treso_encCA: "Revenue receipts (incl. VAT)", treso_encFin: "Financing receipts",
    treso_totEnc: "Total receipts", treso_chgExt: "External expenses payments",
    treso_chgPers: "Personnel expenses payments", treso_invest: "Investment payments",
    treso_tva: "VAT payable", treso_totDec: "Total payments", treso_fluxNet: "Net monthly flow",
    treso_solde: "Cumulative cash balance", treso_graphTitle: "Cumulative balance trend (data bar visualization)",
    bfr_montantLbl: "Estimated Working Capital Requirement", bfr_delaiClientsLbl: "Customer payment term used",
    bfr_delaiFournLbl: "Supplier payment term used", bfr_stockJoursLbl: "Average stock used",
    bfr_joursUnit: "days",
    seuil_montantLbl: "Revenue to reach (break-even point)",
    seuil_joursLbl: "Number of days to reach this threshold (Year 1)",
    seuil_atteintOui: "This threshold is achievable within the first year of activity.",
    seuil_atteintNon: "This threshold would not be reached during the first year based on current assumptions.",
    seuil_nonCalculable: "The break-even point cannot be calculated with the current data (variable cost margin is zero or negative).",
    ratios_infoCol: "Benchmark",
    scenario_caLbl: "Revenue (Year 1)", scenario_rnLbl: "Net income (Year 1)",
    scenario_margeLbl: "Net margin",
  },
  darija: {
    champCol: "الحقل", valeurCol: "القيمة", explicationCol: "التوضيح",
    guideIntroTitle: "مقدمة", guideCommentLireTitle: "كيفاش تقرا هاد الوثيقة؟",
    guideGlossaireTitle: "المعجم", guideConseilsTitle: "نصائح",
    guideErreursTitle: "أخطاء كثر ما تتكرر، خاصك تتفاداها",
    termeCol: "الكلمة", definitionCol: "التعريف",
    identiteTitle: "هوية المشروع", nomProjetLbl: "سمية المشروع",
    secteurLbl: "قطاع النشاط", villeLbl: "المدينة", formeJuridiqueLbl: "الشكل القانوني",
    resumeNarratifTitle: "ملخص بسيط",
    marche_ville: "المدينة المستهدفة", marche_region: "الجهة",
    marche_portee: "نطاق السوق", marche_clientele: "الزبناء المستهدفين",
    marche_type: "نوع السوق", marche_taille: "حجم السوق المقدر (درهم/سنة)",
    marche_tendances: "التطورات اللي كاينة فالقطاع", marche_saisonnalite: "واش القطاع موسمي؟",
    marche_facteurs: "أهم العوامل اللي كتأثر على الطلب",
    clients_profil: "الملف ديال الزبون", clients_age: "الفئة العمرية المستهدفة",
    clients_localisation: "فين كاينين الزبناء", clients_pouvoirAchat: "القدرة الشرائية ديال الزبناء",
    clients_besoins: "أهم حاجيات الزبناء", clients_frequence: "كل شحال كيشريو",
    clients_panier: "متوسط المصروف ديال الزبون", clients_nbClients: "عدد الزبناء المتوقع (سنة 1)",
    clients_croissance: "نسبة زيادة عدد الزبناء (%/سنة)", clients_methode: "كيفاش غادي تجيب الزبناء",
    produits_nom: "السمية", produits_description: "الوصف", produits_prix: "ثمن البيع ديال الواحدة",
    produits_cout: "التكلفة المباشرة ديال الواحدة", produits_qte: "الكمية المبيعة / بالشهر",
    produits_freq: "عدد الشهور اللي كيتباع فيهم فالسنة", produits_marge: "الهامش المرغوب (%)", produits_ca: "رقم المعاملات السنوي",
    totalLbl: "المجموع", produits_aucun: "ما تم دخل حتى منتوج أو خدمة مفصلة فالاستمارة.",
    concurrence_question: "واش تم تحديد منافسين؟",
    concurrence_nom: "السمية", concurrence_prix: "الأتمنة اللي كيخدمو بيها", concurrence_avantages: "المزايا",
    concurrence_faiblesses: "نقط الضعف", concurrence_positionnement: "التموقع المرغوب",
    concurrence_avantageConcurrentiel: "الميزة التنافسية اللي غادي تخدم بيها",
    concurrence_aucun: "حتى منافس ما تحدد من طرف صاحب المشروع دابا. خاصك دير دراسة ميدانية قبل ما تحدد التموقع التجاري النهائي — ما تعتمدش على منافسين ماشي حقيقيين.",
    marketing_methode: "الطريقة اللي غادي تجيب بيها الزبناء (من قسم الزبناء)",
    marketing_conseilsTitle: "نصائح مليحة للتسويق فالسوق المغربية",
    marketing_tips: [
      "الحضور الرقمي : صفحة فيسبوك/إنستغرام و Google Business باش تكون واضح فالحي ديالك.",
      "WhatsApp Business : باش تتواصل مع الزبناء، تاخد الطلبيات وتصيفط تذكيرات.",
      "شراكات محلية : مع التجار أو الجمعيات ديال الحي باش تبان بثمن رخيص.",
      "الكلام الشفهي وآراء الزبناء : خاصك تشجعهم بجد (نظام الإحالة، طلب التقييمات فالنت).",
    ],
    rh_poste: "المنصب", rh_nombre: "العدد", rh_salaire: "الأجر الإجمالي الشهري",
    rh_coutAnnuel: "التكلفة السنوية (تقديرية)", rh_date: "تاريخ التوظيف المتوقع",
    rh_aucun: "ما تم دخل حتى منصب مفصل. الكتلة الأجرية اتخدات من المبلغ الإجمالي اللي تدخل فمرحلة المصاريف (شوف ورقة الفرضيات).",
    invest_local: "المحل (الشرا، حق الدخول)", invest_travaux: "الخدمة / التهيئة",
    invest_equipement: "التجهيزات", invest_machines: "الماكينات", invest_informatique: "العتاد المعلوماتي",
    invest_mobilier: "الموبيليا", invest_vehicule: "السيارة", invest_logiciels: "البرمجيات",
    invest_licences: "الرخص", invest_stock: "المخزون الأولي",
    invest_communication: "التواصل ديال الانطلاقة", invest_frais: "مصاريف تأسيس المقاولة",
    invest_autres: "استثمارات أخرى", invest_totalLbl: "مجموع الاستثمار",
    posteCol: "البند", montantCol: "المبلغ (درهم)",
    financement_emplois: "المصاريف (لي خاصك)", financement_ressources: "الموارد (التمويل)",
    financement_surplus: "الموارد ديالك كتغطي لي خاصك، وبقا عندك فائض ديال",
    financement_deficit: "الموارد ديالك ماكتغطيش لي خاصك : ناقصك",
    financement_deficitSuite: "خاصك تلقا تمويل إضافي باش تسدو (مساهمة، قرض أو إعانة).",
    charges_loyer: "الكراء السنوي", charges_electricite: "الضو", charges_eau: "الما",
    charges_internet: "الأنترنيت", charges_telecommunications: "الاتصالات",
    charges_marketing: "التسويق", charges_transport: "النقل",
    charges_assurance: "التأمين", charges_comptabilite: "المحاسبة",
    charges_logiciels: "اشتراكات البرمجيات", charges_maintenance: "الصيانة",
    charges_matieresPremiere: "المواد الأولية", charges_fraisBancaires: "مصاريف البنك",
    charges_taxes: "الضرائب", charges_autres: "مصاريف أخرى", charges_salaires: "الأجور (ماشي مفصلة فالموارد البشرية)",
    charges_totalLbl: "مجموع المصاريف اللي تدخلات", charges_comparaisonTitle: "مصاريف حساب النتائج المتوقع (للمقارنة)",
    treso_mois: "الشهر", treso_encCA: "دخول رقم المعاملات (بالضريبة)", treso_encFin: "دخول التمويل",
    treso_totEnc: "مجموع الدخول", treso_chgExt: "خروج المصاريف الخارجية",
    treso_chgPers: "خروج الأجور", treso_invest: "خروج الاستثمار",
    treso_tva: "الضريبة الواجب خلاصها", treso_totDec: "مجموع الخروج", treso_fluxNet: "الصافي ديال الشهر",
    treso_solde: "الرصيد المتراكم", treso_graphTitle: "تطور الرصيد المتراكم (بأشرطة البيانات)",
    bfr_montantLbl: "الحاجة لرأس المال العامل المقدرة", bfr_delaiClientsLbl: "أجل خلاص الزبناء المعتمد",
    bfr_delaiFournLbl: "أجل خلاص الموردين المعتمد", bfr_stockJoursLbl: "المخزون المتوسط المعتمد",
    bfr_joursUnit: "نهار",
    seuil_montantLbl: "رقم المعاملات اللي خاصك توصل ليه (نقطة التعادل)",
    seuil_joursLbl: "عدد الأيام باش توصل لهاد النقطة (سنة 1)",
    seuil_atteintOui: "يمكن توصل لهاد النقطة من السنة الأولى ديال النشاط.",
    seuil_atteintNon: "ماغاديش توصل لهاد النقطة فالسنة الأولى حسب الفرضيات الحالية.",
    seuil_nonCalculable: "ما يمكنش نحسبو نقطة التعادل بالمعطيات الحالية.",
    ratios_infoCol: "إشارة مرجعية",
    scenario_caLbl: "رقم المعاملات (سنة 1)", scenario_rnLbl: "الربح الصافي (سنة 1)",
    scenario_margeLbl: "الهامش الصافي",
  },
};

function tr2(lang, key) {
  const d = T[lang] || T.fr;
  return d[key] !== undefined ? d[key] : (T.fr[key] !== undefined ? T.fr[key] : key);
}

// Traductions locales des libellés fixes provenant de financialEngine.js
// (Plan de financement + Ratios), non couvertes par LIGNES_TR de i18n.js.
const PF_LABELS_TR = {
  en: {
    "Immobilisations (matériel, agencements...)": "Fixed assets (equipment, fittings...)",
    "Frais de constitution / établissement": "Incorporation / setup costs",
    "Besoin en Fonds de Roulement (BFR) de démarrage": "Initial Working Capital Requirement",
    "TOTAL EMPLOIS": "TOTAL USES",
    "Apport Personnel (Fonds propres)": "Personal contribution (Equity)",
    "Emprunt Bancaire (Crédit)": "Bank loan",
    "Autres financements / subventions": "Other financing / grants",
    "Trésorerie de départ disponible": "Available starting cash",
    "Complément à financer": "Additional funding required",
    "TOTAL RESSOURCES": "TOTAL SOURCES",
  },
  darija: {
    "Immobilisations (matériel, agencements...)": "التجهيزات (معدات، تهيئات...)",
    "Frais de constitution / établissement": "مصاريف التأسيس",
    "Besoin en Fonds de Roulement (BFR) de démarrage": "الحاجة لرأس المال العامل باش تبدا",
    "TOTAL EMPLOIS": "مجموع لي خاصك",
    "Apport Personnel (Fonds propres)": "المساهمة الشخصية",
    "Emprunt Bancaire (Crédit)": "القرض البنكي",
    "Autres financements / subventions": "تمويلات أخرى / إعانات",
    "Trésorerie de départ disponible": "فلوس متوفرة باش تبدا",
    "Complément à financer": "مبلغ إضافي خاصك تلقاه",
    "TOTAL RESSOURCES": "مجموع الموارد",
  },
};
function trPf(lang, label) {
  if (lang === "fr") return label;
  return (PF_LABELS_TR[lang] && PF_LABELS_TR[lang][label]) || label;
}

const RATIO_LABELS_TR = {
  en: {
    "Marge Nette (Résultat Net / CA)": "Net Margin (Net Income / Revenue)",
    "Marge d'EBE (EBE / CA)": "EBITDA Margin (EBITDA / Revenue)",
    "Rentabilité Financière — ROE (RN / Apport)": "Return on Equity — ROE (Net Income / Contribution)",
    "Rentabilité Économique (RN / Investissement)": "Return on Investment (Net Income / Investment)",
    "Autonomie Financière (Capitaux Propres / Total Actif)": "Financial Autonomy (Equity / Total Assets)",
    "Chiffre d'Affaires par Employé": "Revenue per Employee",
    "Capacité de Remboursement (CAF / annuité moy.)": "Repayment Capacity (CAF / avg. annuity)",
    "Couverture des Charges Financières (RE / Charges fin.)": "Interest Coverage Ratio (Operating Income / Financial Expenses)",
  },
  darija: {
    "Marge Nette (Résultat Net / CA)": "الهامش الصافي (الربح الصافي / رقم المعاملات)",
    "Marge d'EBE (EBE / CA)": "هامش EBE (EBE / رقم المعاملات)",
    "Rentabilité Financière — ROE (RN / Apport)": "المردودية المالية (الربح / المساهمة)",
    "Rentabilité Économique (RN / Investissement)": "المردودية الاقتصادية (الربح / الاستثمار)",
    "Autonomie Financière (Capitaux Propres / Total Actif)": "الاستقلالية المالية",
    "Chiffre d'Affaires par Employé": "رقم المعاملات لكل خدام",
    "Capacité de Remboursement (CAF / annuité moy.)": "القدرة على التسديد",
    "Couverture des Charges Financières (RE / Charges fin.)": "تغطية المصاريف المالية",
  },
};
function trRatio(lang, label) {
  if (lang === "fr") return label;
  return (RATIO_LABELS_TR[lang] && RATIO_LABELS_TR[lang][label]) || label;
}

// ---------------------------------------------------------------------------
// Petits utilitaires
// ---------------------------------------------------------------------------
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function str(v, fallback = "") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}
function boolLabel(lang, v) {
  const t = I18N[lang] || I18N.fr;
  return v ? t.ok : t.non;
}

function sanitizeSheetName(name) {
  return name
    .replace(/[*?:\\/[\]]/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 31);
}

function styleTitleCell(cell) {
  cell.font = { bold: true, size: 16, color: { argb: EMERALD } };
}
function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  row.height = 22;
}
function styleTotalRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.border = { top: { style: "thin" } };
  });
}
function styleSectionRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: NAVY } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_FILL } };
  });
}

/**
 * Crée un nouvel onglet numéroté, avec RTL/gel de la ligne d'en-tête,
 * mise en page et pied de page déjà configurés.
 */
function addSheet(wb, index, titleKey, lang, { orientation = "landscape", freeze = 1 } = {}) {
  const rtl = !!(I18N[lang] || I18N.fr).dirRTL;
  const title = (I18N[lang] || I18N.fr)[titleKey] || titleKey;
  const name = sanitizeSheetName(`${String(index).padStart(2, "0")} ${title}`);
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: freeze, rightToLeft: rtl }],
  });
  ws.pageSetup = { fitToPage: true, fitToWidth: 1, orientation };
  ws.headerFooter = { oddFooter: `&C${FOOTER[lang] || FOOTER.fr}    &P/&N` };
  return ws;
}

function addTitle(ws, text, span = 4) {
  ws.addRow([]);
  const row = ws.addRow([text]);
  styleTitleCell(row.getCell(1));
  if (span > 1) ws.mergeCells(row.number, 1, row.number, span);
  ws.addRow([]);
  return row;
}

function addParagraphs(ws, paragraphs, span = 4) {
  for (const p of paragraphs) {
    const row = ws.addRow([p]);
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
    if (span > 1) ws.mergeCells(row.number, 1, row.number, span);
    row.height = Math.max(18, Math.ceil(String(p).length / 90) * 15);
  }
}

function addKV(ws, label, value, { fmt } = {}) {
  const row = ws.addRow([label, value]);
  row.getCell(1).font = { bold: true };
  if (fmt) row.getCell(2).numFmt = fmt;
  row.getCell(2).alignment = { wrapText: true };
  return row;
}

// ---------------------------------------------------------------------------
// Onglet 1 — Guide
// ---------------------------------------------------------------------------
function buildGuide(wb, bp, formData, lang) {
  const ws = addSheet(wb, 1, "guide", lang, { orientation: "portrait", freeze: 0 });
  ws.columns = [{ width: 42 }, { width: 42 }];
  const guide = GUIDE_PEDAGOGIQUE[lang] || GUIDE_PEDAGOGIQUE.fr;
  const t = I18N[lang] || I18N.fr;

  addTitle(ws, t.titreBP, 2);
  ws.addRow([t.sousTitre]).getCell(1).font = { italic: true, size: 11 };
  ws.addRow([]);

  const introRow = ws.addRow([tr2(lang, "guideIntroTitle")]);
  styleSectionRow(introRow);
  ws.mergeCells(introRow.number, 1, introRow.number, 2);
  addParagraphs(ws, [guide.intro], 2);
  ws.addRow([]);

  const lireRow = ws.addRow([tr2(lang, "guideCommentLireTitle")]);
  styleSectionRow(lireRow);
  ws.mergeCells(lireRow.number, 1, lireRow.number, 2);
  addParagraphs(ws, guide.commentLire.map((s) => "• " + s), 2);
  ws.addRow([]);

  const glossRow = ws.addRow([tr2(lang, "guideGlossaireTitle")]);
  styleSectionRow(glossRow);
  ws.mergeCells(glossRow.number, 1, glossRow.number, 2);
  const glossHeader = ws.addRow([tr2(lang, "termeCol"), tr2(lang, "definitionCol")]);
  styleHeaderRow(glossHeader);
  for (const g of guide.glossaire) {
    const r = ws.addRow([g.terme, g.def]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).alignment = { wrapText: true };
    r.getCell(1).alignment = { wrapText: true, vertical: "top" };
  }
  ws.addRow([]);

  const conseilsRow = ws.addRow([tr2(lang, "guideConseilsTitle")]);
  styleSectionRow(conseilsRow);
  ws.mergeCells(conseilsRow.number, 1, conseilsRow.number, 2);
  addParagraphs(ws, guide.conseils.map((s) => "• " + s), 2);
  ws.addRow([]);

  const erreursRow = ws.addRow([tr2(lang, "guideErreursTitle")]);
  styleSectionRow(erreursRow);
  ws.mergeCells(erreursRow.number, 1, erreursRow.number, 2);
  addParagraphs(ws, guide.erreurs.map((s) => "• " + s), 2);
  ws.addRow([]);
  ws.addRow([t.avertissement]).getCell(1).font = { italic: true, size: 9, color: { argb: "FF888888" } };
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, 2);
}

// ---------------------------------------------------------------------------
// Onglet 2 — Résumé du projet
// ---------------------------------------------------------------------------
function buildResume(wb, bp, formData, lang) {
  const ws = addSheet(wb, 2, "resume", lang, { orientation: "portrait", freeze: 0 });
  ws.columns = [{ width: 30 }, { width: 55 }];
  const t = I18N[lang] || I18N.fr;

  addTitle(ws, t.resume, 2);

  const identRow = ws.addRow([tr2(lang, "identiteTitle")]);
  styleSectionRow(identRow);
  ws.mergeCells(identRow.number, 1, identRow.number, 2);
  addKV(ws, tr2(lang, "nomProjetLbl"), bp.inputs.nomProjet);
  addKV(ws, tr2(lang, "secteurLbl"), bp.inputs.secteur);
  addKV(ws, tr2(lang, "villeLbl"), bp.inputs.ville);
  addKV(ws, tr2(lang, "formeJuridiqueLbl"), bp.inputs.formeJuridique);
  ws.addRow([]);

  const narrRow = ws.addRow([tr2(lang, "resumeNarratifTitle")]);
  styleSectionRow(narrRow);
  ws.mergeCells(narrRow.number, 1, narrRow.number, 2);
  const paragraphs = genererResumeNarratif(formData, bp, lang);
  addParagraphs(ws, paragraphs, 2);
}

// ---------------------------------------------------------------------------
// Onglet 3 — Hypothèses
// ---------------------------------------------------------------------------
const PCT_FIELDS = new Set(["croissance", "chargesExtPct", "tauxInteret"]);
const COUNT_FIELDS = new Set(["nbEmployes", "dureeCredit", "delaiClients", "delaiFourn", "stockJours"]);

function buildHypotheses(wb, bp, formData, lang) {
  const ws = addSheet(wb, 3, "hypotheses", lang, { orientation: "landscape" });
  ws.columns = [{ width: 32 }, { width: 18 }, { width: 26 }, { width: 55 }];
  const t = I18N[lang] || I18N.fr;

  addTitle(ws, t.hypotheses, 4);
  const header = ws.addRow([t.rubrique, t.montant, t.source, tr2(lang, "explicationCol")]);
  styleHeaderRow(header);

  for (const h of bp.hypotheses || []) {
    const row = ws.addRow([h.label, h.valeur, labelSource(lang, h.source), h.explication]);
    if (PCT_FIELDS.has(h.champ)) row.getCell(2).numFmt = PCT_FMT;
    else if (COUNT_FIELDS.has(h.champ)) row.getCell(2).numFmt = INT_FMT;
    else row.getCell(2).numFmt = CURRENCY_FMT;
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };
    row.getCell(3).alignment = { wrapText: true, vertical: "top", horizontal: "center" };
  }
}

// ---------------------------------------------------------------------------
// Onglet 4 — Marché
// ---------------------------------------------------------------------------
function buildMarche(wb, bp, formData, lang) {
  const ws = addSheet(wb, 4, "marche", lang, { orientation: "portrait", freeze: 0 });
  ws.columns = [{ width: 34 }, { width: 55 }];
  const t = I18N[lang] || I18N.fr;
  const m = formData?.marche || {};

  addTitle(ws, t.marche, 2);
  addKV(ws, tr2(lang, "marche_ville"), str(m.ville, "—"));
  addKV(ws, tr2(lang, "marche_region"), str(m.region, "—"));
  addKV(ws, tr2(lang, "marche_portee"), str(m.portee, "—"));
  addKV(ws, tr2(lang, "marche_clientele"), str(m.clienteleCible, "—"));
  addKV(ws, tr2(lang, "marche_type"), str(m.typeMarche, "—"));
  addKV(ws, tr2(lang, "marche_taille"), num(m.tailleMarcheEstimee, 0), { fmt: CURRENCY_FMT });
  addKV(ws, tr2(lang, "marche_tendances"), str(m.tendancesSecteur, "—"));
  addKV(ws, tr2(lang, "marche_saisonnalite"), str(m.saisonnalite, "—"));
  addKV(ws, tr2(lang, "marche_facteurs"), str(m.facteursDemande, "—"));
}

// ---------------------------------------------------------------------------
// Onglet 5 — Clients
// ---------------------------------------------------------------------------
function buildClients(wb, bp, formData, lang) {
  const ws = addSheet(wb, 5, "clients", lang, { orientation: "portrait", freeze: 0 });
  ws.columns = [{ width: 34 }, { width: 55 }];
  const t = I18N[lang] || I18N.fr;
  const c = formData?.clients || {};

  addTitle(ws, t.clients, 2);
  addKV(ws, tr2(lang, "clients_profil"), str(c.profilClient, "—"));
  addKV(ws, tr2(lang, "clients_age"), str(c.ageCible, "—"));
  addKV(ws, tr2(lang, "clients_localisation"), str(c.localisationClients, "—"));
  addKV(ws, tr2(lang, "clients_pouvoirAchat"), str(c.pouvoirAchat, "—"));
  addKV(ws, tr2(lang, "clients_besoins"), str(c.besoins, "—"));
  addKV(ws, tr2(lang, "clients_frequence"), str(c.frequenceAchat, "—"));
  addKV(ws, tr2(lang, "clients_panier"), num(c.panierMoyen, 0), { fmt: CURRENCY_FMT });
  addKV(ws, tr2(lang, "clients_nbClients"), num(c.nombreClientsPrevu, 0), { fmt: INT_FMT });
  addKV(ws, tr2(lang, "clients_croissance"), num(c.tauxCroissanceClients, 0), { fmt: PCT_FMT });
  addKV(ws, tr2(lang, "clients_methode"), str(c.methodeAcquisition, "—"));
}

// ---------------------------------------------------------------------------
// Onglet 6 — Produits / Services (+ réutilisé au sein de l'onglet 12)
// ---------------------------------------------------------------------------
function renderProduitsTable(ws, formData, lang, startRowIndex) {
  const t = tr2;
  const header = ws.addRow([
    t(lang, "produits_nom"), t(lang, "produits_description"), t(lang, "produits_prix"),
    t(lang, "produits_cout"), t(lang, "produits_qte"), t(lang, "produits_freq"),
    t(lang, "produits_marge"), t(lang, "produits_ca"),
  ]);
  styleHeaderRow(header);
  const produits = formData?.produits || [];
  const firstDataRow = header.number + 1;

  if (produits.length === 0) {
    const r = ws.addRow([t(lang, "produits_aucun")]);
    ws.mergeCells(r.number, 1, r.number, 8);
    r.getCell(1).alignment = { wrapText: true };
    return { lastRow: r.number, total: 0 };
  }

  for (const p of produits) {
    const row = ws.addRow([
      str(p.nom, "—"), str(p.description, ""), num(p.prixVente, 0), num(p.coutDirect, 0),
      num(p.quantiteEstimeeParMois, 0), num(p.frequenceVenteParAn, 12), num(p.margeSouhaitee, 0),
      null,
    ]);
    const rn = row.number;
    row.getCell(8).value = { formula: `C${rn}*E${rn}*F${rn}` };
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
    row.getCell(7).numFmt = PCT_FMT;
    row.getCell(8).numFmt = CURRENCY_FMT;
  }
  const lastDataRow = ws.rowCount;
  const totalRow = ws.addRow([t(lang, "totalLbl"), "", "", "", "", "", "", { formula: `SUM(H${firstDataRow}:H${lastDataRow})` }]);
  totalRow.getCell(8).numFmt = CURRENCY_FMT;
  styleTotalRow(totalRow);
  return { lastRow: totalRow.number, total: produits.length };
}

function buildProduits(wb, bp, formData, lang) {
  const ws = addSheet(wb, 6, "produits", lang, { orientation: "landscape" });
  ws.columns = [{ width: 22 }, { width: 30 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 }];
  const t = I18N[lang] || I18N.fr;
  addTitle(ws, t.produits, 8);
  renderProduitsTable(ws, formData, lang);
}

// ---------------------------------------------------------------------------
// Onglet 7 — Stratégie commerciale (Concurrence)
// ---------------------------------------------------------------------------
function buildStrategieCommerciale(wb, bp, formData, lang) {
  const ws = addSheet(wb, 7, "strategieCommerciale", lang, { orientation: "portrait", freeze: 0 });
  ws.columns = [{ width: 34 }, { width: 55 }];
  const t = I18N[lang] || I18N.fr;
  const c = formData?.concurrence || {};

  addTitle(ws, t.strategieCommerciale, 2);
  addKV(ws, tr2(lang, "concurrence_question"), boolLabel(lang, !!c.connaitConcurrents));
  ws.addRow([]);

  if (c.connaitConcurrents && Array.isArray(c.concurrents) && c.concurrents.length > 0) {
    const header = ws.addRow([
      tr2(lang, "concurrence_nom"), tr2(lang, "concurrence_prix"),
      tr2(lang, "concurrence_avantages"), tr2(lang, "concurrence_faiblesses"),
    ]);
    ws.getColumn(3).width = 30;
    ws.getColumn(4).width = 30;
    styleHeaderRow(header);
    for (const comp of c.concurrents) {
      const r = ws.addRow([str(comp.nom, "—"), str(comp.prix, "—"), str(comp.avantages, "—"), str(comp.faiblesses, "—")]);
      r.eachCell((cell) => (cell.alignment = { wrapText: true, vertical: "top" }));
    }
  } else {
    const r = ws.addRow([tr2(lang, "concurrence_aucun")]);
    ws.mergeCells(r.number, 1, r.number, 2);
    r.getCell(1).alignment = { wrapText: true };
    r.getCell(1).font = { italic: true };
  }
  ws.addRow([]);
  addKV(ws, tr2(lang, "concurrence_positionnement"), str(c.positionnementSouhaite, "—"));
  addKV(ws, tr2(lang, "concurrence_avantageConcurrentiel"), str(c.avantageConcurrentiel, "—"));
}

// ---------------------------------------------------------------------------
// Onglet 8 — Marketing
// ---------------------------------------------------------------------------
function buildMarketing(wb, bp, formData, lang) {
  const ws = addSheet(wb, 8, "marketing", lang, { orientation: "portrait", freeze: 0 });
  ws.columns = [{ width: 90 }];
  const t = I18N[lang] || I18N.fr;
  const c = formData?.clients || {};

  addTitle(ws, t.marketing, 1);
  addKV(ws, tr2(lang, "marketing_methode"), str(c.methodeAcquisition, "—"));
  ws.addRow([]);
  const secRow = ws.addRow([tr2(lang, "marketing_conseilsTitle")]);
  styleSectionRow(secRow);
  addParagraphs(ws, (tr2(lang, "marketing_tips") || []).map((s) => "• " + s), 1);
}

// ---------------------------------------------------------------------------
// Onglet 9 — Ressources humaines
// ---------------------------------------------------------------------------
function buildRH(wb, bp, formData, lang) {
  const ws = addSheet(wb, 9, "rh", lang, { orientation: "landscape" });
  ws.columns = [{ width: 26 }, { width: 12 }, { width: 20 }, { width: 22 }, { width: 22 }];
  const t = I18N[lang] || I18N.fr;
  addTitle(ws, t.rh, 5);

  const header = ws.addRow([tr2(lang, "rh_poste"), tr2(lang, "rh_nombre"), tr2(lang, "rh_salaire"), tr2(lang, "rh_coutAnnuel"), tr2(lang, "rh_date")]);
  styleHeaderRow(header);
  const rh = formData?.ressourcesHumaines || [];
  const firstDataRow = header.number + 1;

  if (rh.length === 0) {
    const r = ws.addRow([tr2(lang, "rh_aucun")]);
    ws.mergeCells(r.number, 1, r.number, 5);
    r.getCell(1).alignment = { wrapText: true };
  } else {
    for (const poste of rh) {
      const row = ws.addRow([str(poste.poste, "—"), num(poste.nombre, 1), num(poste.salaireBrutMensuel, 0), null, str(poste.dateEmbauchePrevue, "—")]);
      const rn = row.number;
      row.getCell(4).value = { formula: `B${rn}*C${rn}*12` };
      row.getCell(3).numFmt = CURRENCY_FMT;
      row.getCell(4).numFmt = CURRENCY_FMT;
    }
    const lastDataRow = ws.rowCount;
    const totalRow = ws.addRow([tr2(lang, "totalLbl"), "", "", { formula: `SUM(D${firstDataRow}:D${lastDataRow})` }, ""]);
    totalRow.getCell(4).numFmt = CURRENCY_FMT;
    styleTotalRow(totalRow);
  }
}

// ---------------------------------------------------------------------------
// Onglet 10 — Investissement
// ---------------------------------------------------------------------------
const INVEST_FIELDS = [
  ["local", "invest_local"], ["travaux", "invest_travaux"], ["equipement", "invest_equipement"],
  ["machines", "invest_machines"], ["informatique", "invest_informatique"], ["mobilier", "invest_mobilier"],
  ["vehicule", "invest_vehicule"], ["logiciels", "invest_logiciels"], ["licences", "invest_licences"],
  ["stockInitial", "invest_stock"], ["communication", "invest_communication"], ["fraisCreation", "invest_frais"],
  ["autres", "invest_autres"],
];

function buildInvestissement(wb, bp, formData, lang) {
  const ws = addSheet(wb, 10, "investissement", lang, { orientation: "portrait", freeze: 1 });
  ws.columns = [{ width: 34 }, { width: 20 }];
  const t = I18N[lang] || I18N.fr;
  addTitle(ws, t.investissement, 2);
  const header = ws.addRow([tr2(lang, "posteCol"), tr2(lang, "montantCol")]);
  styleHeaderRow(header);
  const inv = formData?.investissement || {};
  const firstDataRow = header.number + 1;
  for (const [key, labelKey] of INVEST_FIELDS) {
    const row = ws.addRow([tr2(lang, labelKey), num(inv[key], 0)]);
    row.getCell(2).numFmt = CURRENCY_FMT;
  }
  const lastDataRow = ws.rowCount;
  const totalRow = ws.addRow([tr2(lang, "invest_totalLbl"), { formula: `SUM(B${firstDataRow}:B${lastDataRow})` }]);
  totalRow.getCell(2).numFmt = CURRENCY_FMT;
  styleTotalRow(totalRow);
}

// ---------------------------------------------------------------------------
// Onglet 11 — Financement
// ---------------------------------------------------------------------------
function buildFinancement(wb, bp, formData, lang) {
  const ws = addSheet(wb, 11, "financement", lang, { orientation: "landscape", freeze: 0 });
  ws.columns = [{ width: 34 }, { width: 18 }, { width: 4 }, { width: 34 }, { width: 18 }];
  const t = I18N[lang] || I18N.fr;
  addTitle(ws, t.financement, 5);

  // Colonnes A-B pour les emplois, D-E pour les ressources (colonne C = séparateur).
  let rowCursor = ws.rowCount + 1;
  const writeAt = (r, col, value, opts = {}) => {
    const row = ws.getRow(r);
    const cell = row.getCell(col);
    cell.value = value;
    if (opts.numFmt) cell.numFmt = opts.numFmt;
    return cell;
  };

  // Titres
  writeAt(rowCursor, 1, tr2(lang, "financement_emplois"));
  writeAt(rowCursor, 4, tr2(lang, "financement_ressources"));
  styleSectionRow(ws.getRow(rowCursor));
  ws.mergeCells(rowCursor, 1, rowCursor, 2);
  ws.mergeCells(rowCursor, 4, rowCursor, 5);
  rowCursor++;

  // En-têtes
  writeAt(rowCursor, 1, tr2(lang, "posteCol"));
  writeAt(rowCursor, 2, tr2(lang, "montantCol"));
  writeAt(rowCursor, 4, tr2(lang, "posteCol"));
  writeAt(rowCursor, 5, tr2(lang, "montantCol"));
  styleHeaderRow(ws.getRow(rowCursor));
  rowCursor++;

  const emplois = bp.pf.emplois;
  const ressources = bp.pf.ressources;
  const emploisData = emplois.slice(0, -1);
  const emploisTotal = emplois[emplois.length - 1];
  const ressourcesData = ressources.slice(0, -1);
  const ressourcesTotal = ressources[ressources.length - 1];
  const maxLen = Math.max(emploisData.length, ressourcesData.length);
  const firstDataRow = rowCursor;

  for (let i = 0; i < maxLen; i++) {
    if (emploisData[i]) {
      writeAt(rowCursor, 1, trPf(lang, emploisData[i][0]));
      writeAt(rowCursor, 2, num(emploisData[i][1], 0), { numFmt: CURRENCY_FMT });
    }
    if (ressourcesData[i]) {
      writeAt(rowCursor, 4, trPf(lang, ressourcesData[i][0]));
      writeAt(rowCursor, 5, num(ressourcesData[i][1], 0), { numFmt: CURRENCY_FMT });
    }
    rowCursor++;
  }
  const lastDataRow = rowCursor - 1;
  writeAt(rowCursor, 1, trPf(lang, emploisTotal[0]));
  writeAt(rowCursor, 2, { formula: `SUM(B${firstDataRow}:B${lastDataRow})` }, { numFmt: CURRENCY_FMT });
  writeAt(rowCursor, 4, trPf(lang, ressourcesTotal[0]));
  writeAt(rowCursor, 5, { formula: `SUM(E${firstDataRow}:E${lastDataRow})` }, { numFmt: CURRENCY_FMT });
  styleTotalRow(ws.getRow(rowCursor));
  rowCursor += 2;

  const ecart = bp.pf.ecart;
  const noteRow = ws.getRow(rowCursor);
  if (ecart >= 0) {
    noteRow.getCell(1).value = `${tr2(lang, "financement_surplus")} ${fmtDH(ecart)}.`;
  } else {
    noteRow.getCell(1).value = `${tr2(lang, "financement_deficit")} ${fmtDH(Math.abs(ecart))} ${tr2(lang, "financement_deficitSuite")}`;
  }
  noteRow.getCell(1).font = { italic: true, bold: true };
  noteRow.getCell(1).alignment = { wrapText: true };
  ws.mergeCells(rowCursor, 1, rowCursor, 5);
  noteRow.commit();
}

// ---------------------------------------------------------------------------
// Onglet 12 — Chiffre d'affaires prévisionnel
// ---------------------------------------------------------------------------
function buildCAPrevisionnel(wb, bp, formData, lang) {
  const ws = addSheet(wb, 12, "caPrevisionnel", lang, { orientation: "landscape" });
  ws.columns = [{ width: 26 }, { width: 18 }, { width: 18 }, { width: 18 }];
  const t = I18N[lang] || I18N.fr;
  addTitle(ws, t.caPrevisionnel, 4);

  const header = ws.addRow([t.rubrique, anneeLabel(lang, 0), anneeLabel(lang, 1), anneeLabel(lang, 2)]);
  styleHeaderRow(header);
  const row = ws.addRow([t.caPrevisionnel, bp.cpc.ca[0], bp.cpc.ca[1], bp.cpc.ca[2]]);
  row.eachCell((c) => (c.numFmt = CURRENCY_FMT));
  row.getCell(1).numFmt = undefined;
  row.getCell(1).font = { bold: true };

  ws.addRow([]);
  const sub = ws.addRow([t.produits]);
  styleSectionRow(sub);
  ws.mergeCells(sub.number, 1, sub.number, 4);
  renderProduitsTableCompact(ws, formData, lang);
}

// Version compacte du tableau produits (mêmes données, réutilisée pour contexte).
function renderProduitsTableCompact(ws, formData, lang) {
  const header = ws.addRow([tr2(lang, "produits_nom"), tr2(lang, "produits_prix"), tr2(lang, "produits_qte"), tr2(lang, "produits_ca")]);
  styleHeaderRow(header);
  const produits = formData?.produits || [];
  const firstDataRow = header.number + 1;
  if (produits.length === 0) {
    const r = ws.addRow([tr2(lang, "produits_aucun")]);
    ws.mergeCells(r.number, 1, r.number, 4);
    r.getCell(1).alignment = { wrapText: true };
    return;
  }
  for (const p of produits) {
    const row = ws.addRow([str(p.nom, "—"), num(p.prixVente, 0), num(p.quantiteEstimeeParMois, 0), null]);
    const rn = row.number;
    row.getCell(4).value = { formula: `B${rn}*C${rn}*${num(p.frequenceVenteParAn, 12)}` };
    row.getCell(2).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
  }
  const lastDataRow = ws.rowCount;
  const totalRow = ws.addRow([tr2(lang, "totalLbl"), "", "", { formula: `SUM(D${firstDataRow}:D${lastDataRow})` }]);
  totalRow.getCell(4).numFmt = CURRENCY_FMT;
  styleTotalRow(totalRow);
}

// ---------------------------------------------------------------------------
// Onglet 13 — Charges
// ---------------------------------------------------------------------------
const CHARGES_FIELDS = [
  ["loyer", "charges_loyer"], ["electricite", "charges_electricite"], ["eau", "charges_eau"],
  ["internet", "charges_internet"], ["telecommunications", "charges_telecommunications"],
  ["marketing", "charges_marketing"], ["transport", "charges_transport"], ["assurance", "charges_assurance"],
  ["comptabilite", "charges_comptabilite"], ["logiciels", "charges_logiciels"], ["maintenance", "charges_maintenance"],
  ["matieresPremiere", "charges_matieresPremiere"], ["fraisBancaires", "charges_fraisBancaires"],
  ["taxes", "charges_taxes"], ["autres", "charges_autres"], ["salaires", "charges_salaires"],
];

function buildCharges(wb, bp, formData, lang) {
  const ws = addSheet(wb, 13, "charges", lang, { orientation: "landscape" });
  ws.columns = [{ width: 32 }, { width: 16 }, { width: 16 }, { width: 16 }];
  const t = I18N[lang] || I18N.fr;
  addTitle(ws, t.charges, 4);

  const header = ws.addRow([tr2(lang, "posteCol"), tr2(lang, "montantCol")]);
  styleHeaderRow(header);
  const ch = formData?.charges || {};
  const firstDataRow = header.number + 1;
  for (const [key, labelKey] of CHARGES_FIELDS) {
    const row = ws.addRow([tr2(lang, labelKey), num(ch[key], 0)]);
    row.getCell(2).numFmt = CURRENCY_FMT;
  }
  const lastDataRow = ws.rowCount;
  const totalRow = ws.addRow([tr2(lang, "charges_totalLbl"), { formula: `SUM(B${firstDataRow}:B${lastDataRow})` }]);
  totalRow.getCell(2).numFmt = CURRENCY_FMT;
  styleTotalRow(totalRow);

  ws.addRow([]);
  const sub = ws.addRow([tr2(lang, "charges_comparaisonTitle")]);
  styleSectionRow(sub);
  ws.mergeCells(sub.number, 1, sub.number, 4);
  const header2 = ws.addRow([t.rubrique, anneeLabel(lang, 0), anneeLabel(lang, 1), anneeLabel(lang, 2)]);
  styleHeaderRow(header2);
  const cpcChargesRows = [
    { label: "Achats consommés", vals: bp.cpc.achats },
    { label: "Charges externes", vals: bp.cpc.chargesExt },
    { label: "Impôts & taxes", vals: bp.cpc.impotsTaxes },
    { label: "Charges de personnel", vals: bp.cpc.chargesPersonnel },
    { label: "Dotations aux amortissements", vals: bp.cpc.dotations },
  ];
  for (const r of cpcChargesRows) {
    const row = ws.addRow([trLigne(r.label, lang), r.vals[0], r.vals[1], r.vals[2]]);
    row.getCell(2).numFmt = CURRENCY_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
  }
}

// ---------------------------------------------------------------------------
// Onglet 14 — Compte de résultat prévisionnel (CPC)
// ---------------------------------------------------------------------------
const CPC_BOLD_LABELS = new Set(["Total Charges d'Exploitation", "Résultat d'Exploitation", "Résultat Courant Avant Impôt", "Résultat Net"]);

function buildCPC(wb, bp, formData, lang) {
  const ws = addSheet(wb, 14, "cpc", lang, { orientation: "landscape" });
  ws.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }];
  const t = I18N[lang] || I18N.fr;
  addTitle(ws, t.cpc, 4);

  const header = ws.addRow([t.rubrique, anneeLabel(lang, 0), anneeLabel(lang, 1), anneeLabel(lang, 2)]);
  styleHeaderRow(header);
  for (const r of bp.cpc.rows) {
    const row = ws.addRow([trLigne(r.label, lang), r.vals[0], r.vals[1], r.vals[2]]);
    row.getCell(2).numFmt = CURRENCY_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
    if (CPC_BOLD_LABELS.has(r.label)) styleTotalRow(row);
  }
}

// ---------------------------------------------------------------------------
// Onglet 15 — Trésorerie
// ---------------------------------------------------------------------------
function buildTresorerie(wb, bp, formData, lang) {
  const ws = addSheet(wb, 15, "tresorerie", lang, { orientation: "landscape" });
  ws.columns = [
    { width: 10 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 14 }, { width: 18 },
  ];
  const t = I18N[lang] || I18N.fr;
  addTitle(ws, t.tresorerie, 11);

  const header = ws.addRow([
    tr2(lang, "treso_mois"), tr2(lang, "treso_encCA"), tr2(lang, "treso_encFin"), tr2(lang, "treso_totEnc"),
    tr2(lang, "treso_chgExt"), tr2(lang, "treso_chgPers"), tr2(lang, "treso_invest"), tr2(lang, "treso_tva"),
    tr2(lang, "treso_totDec"), tr2(lang, "treso_fluxNet"), tr2(lang, "treso_solde"),
  ]);
  styleHeaderRow(header);
  const firstDataRow = header.number + 1;
  for (const m of bp.treso) {
    const row = ws.addRow([m.mois, m.encCA, m.encFin, m.totEnc, m.chgExt, m.chgPers, m.invest, m.tva, m.totDec, m.fluxNet, m.soldeCumule]);
    for (let c = 2; c <= 11; c++) row.getCell(c).numFmt = CURRENCY_FMT;
  }
  const lastDataRow = ws.rowCount;

  ws.addRow([]);
  const sub = ws.addRow([tr2(lang, "treso_graphTitle")]);
  styleSectionRow(sub);
  ws.mergeCells(sub.number, 1, sub.number, 11);

  ws.addConditionalFormatting({
    ref: `K${firstDataRow}:K${lastDataRow}`,
    rules: [
      {
        type: "dataBar",
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: EMERALD },
        gradient: false,
        border: true,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Onglet 16 — Besoin en fonds de roulement (BFR)
// ---------------------------------------------------------------------------
function buildBFR(wb, bp, formData, lang) {
  const ws = addSheet(wb, 16, "bfr", lang, { orientation: "portrait", freeze: 0 });
  ws.columns = [{ width: 40 }, { width: 30 }];
  const t = I18N[lang] || I18N.fr;
  const guide = GUIDE_PEDAGOGIQUE[lang] || GUIDE_PEDAGOGIQUE.fr;

  addTitle(ws, t.bfr, 2);
  const bfrDef = guide.glossaire.find((g2) => /fonds de roulement|رأس المال العامل/i.test(g2.terme));
  if (bfrDef) {
    const r = ws.addRow([bfrDef.def]);
    ws.mergeCells(r.number, 1, r.number, 2);
    r.getCell(1).alignment = { wrapText: true };
    ws.addRow([]);
  }
  addKV(ws, tr2(lang, "bfr_montantLbl"), num(bp.pf.bfrEstime, 0), { fmt: CURRENCY_FMT });
  ws.addRow([]);
  addKV(ws, tr2(lang, "bfr_delaiClientsLbl"), `${num(bp.inputs.delaiClients, 0)} ${tr2(lang, "bfr_joursUnit")}`);
  addKV(ws, tr2(lang, "bfr_delaiFournLbl"), `${num(bp.inputs.delaiFourn, 0)} ${tr2(lang, "bfr_joursUnit")}`);
  addKV(ws, tr2(lang, "bfr_stockJoursLbl"), `${num(bp.inputs.stockJours, 0)} ${tr2(lang, "bfr_joursUnit")}`);
}

// ---------------------------------------------------------------------------
// Onglet 17 — Seuil de rentabilité
// ---------------------------------------------------------------------------
function buildSeuilRentabilite(wb, bp, formData, lang) {
  const ws = addSheet(wb, 17, "seuilRentabilite", lang, { orientation: "portrait", freeze: 0 });
  ws.columns = [{ width: 45 }, { width: 25 }];
  const t = I18N[lang] || I18N.fr;
  const guide = GUIDE_PEDAGOGIQUE[lang] || GUIDE_PEDAGOGIQUE.fr;

  addTitle(ws, t.seuilRentabilite, 2);
  const def = guide.glossaire.find((g2) => /seuil de rentabilit|عتبة الربحية|نقطة التعادل/i.test(g2.terme));
  if (def) {
    const r = ws.addRow([def.def]);
    ws.mergeCells(r.number, 1, r.number, 2);
    r.getCell(1).alignment = { wrapText: true };
    ws.addRow([]);
  }

  const sr = bp.seuilRentabilite;
  if (!sr) {
    const r = ws.addRow([tr2(lang, "seuil_nonCalculable")]);
    ws.mergeCells(r.number, 1, r.number, 2);
    r.getCell(1).font = { italic: true };
    r.getCell(1).alignment = { wrapText: true };
    return;
  }
  addKV(ws, tr2(lang, "seuil_montantLbl"), num(sr.seuilCA, 0), { fmt: CURRENCY_FMT });
  addKV(ws, tr2(lang, "seuil_joursLbl"), sr.joursAtteinte !== null && sr.joursAtteinte !== undefined ? sr.joursAtteinte : "—");
  ws.addRow([]);
  const r = ws.addRow([sr.atteintDansAnnee1 ? tr2(lang, "seuil_atteintOui") : tr2(lang, "seuil_atteintNon")]);
  ws.mergeCells(r.number, 1, r.number, 2);
  r.getCell(1).font = { bold: true };
  r.getCell(1).alignment = { wrapText: true };
}

// ---------------------------------------------------------------------------
// Onglet 18 — Analyse financière (ratios)
// ---------------------------------------------------------------------------
function buildAnalyseFinanciere(wb, bp, formData, lang) {
  const ws = addSheet(wb, 18, "analyseFinanciere", lang, { orientation: "landscape" });
  ws.columns = [{ width: 45 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 40 }];
  const t = I18N[lang] || I18N.fr;
  addTitle(ws, t.analyseFinanciere, 5);

  const header = ws.addRow([t.rubrique, anneeLabel(lang, 0), anneeLabel(lang, 1), anneeLabel(lang, 2), tr2(lang, "ratios_infoCol")]);
  styleHeaderRow(header);
  for (const r of bp.ratios) {
    const fmt = r.unit === "%" ? PCT_FMT : r.unit === "x" ? X_FMT : CURRENCY_FMT;
    const row = ws.addRow([trRatio(lang, r.label), r.vals[0], r.vals[1], r.vals[2], r.info || ""]);
    for (let c = 2; c <= 4; c++) {
      if (row.getCell(c).value === null || row.getCell(c).value === undefined) continue;
      row.getCell(c).numFmt = fmt;
    }
    row.getCell(5).alignment = { wrapText: true };
  }
}

// ---------------------------------------------------------------------------
// Onglet 19 — Scénarios
// ---------------------------------------------------------------------------
function buildScenarios(wb, bp, formData, lang) {
  const ws = addSheet(wb, 19, "scenarios", lang, { orientation: "landscape" });
  ws.columns = [{ width: 22 }, { width: 22 }, { width: 22 }, { width: 18 }];
  const t = I18N[lang] || I18N.fr;
  addTitle(ws, t.scenarios, 4);

  const header = ws.addRow([t.rubrique, tr2(lang, "scenario_caLbl"), tr2(lang, "scenario_rnLbl"), tr2(lang, "scenario_margeLbl")]);
  styleHeaderRow(header);
  const scenarios = genererScenarios(bp.cpc);
  for (const s of scenarios) {
    const label = t[s.id] || s.id;
    const row = ws.addRow([label, s.ca, s.rn, s.marge]);
    row.getCell(2).numFmt = CURRENCY_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = PCT_FMT;
    if (s.id === "realiste") styleTotalRow(row);
  }
}

// ---------------------------------------------------------------------------
// Onglet 20 — Conseils stratégiques
// ---------------------------------------------------------------------------
function buildConseils(wb, bp, formData, lang) {
  const ws = addSheet(wb, 20, "conseils", lang, { orientation: "portrait", freeze: 0 });
  ws.columns = [{ width: 100 }];
  const t = I18N[lang] || I18N.fr;
  addTitle(ws, t.conseils, 1);
  const conseils = genererConseilsEntrepreneur(formData, bp, lang) || [];
  addParagraphs(ws, conseils.map((s) => "• " + s), 1);
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------
export async function buildEntrepreneurWorkbook(bp, formData, lang) {
  const effectiveLang = I18N[lang] ? lang : "fr";
  const wb = new ExcelJS.Workbook();
  wb.creator = "One Click BP";
  wb.created = new Date();
  wb.views = [{ x: 0, y: 0, width: 24000, height: 16000, firstSheet: 0, activeTab: 0, rtl: !!(I18N[effectiveLang] || I18N.fr).dirRTL }];

  buildGuide(wb, bp, formData, effectiveLang);
  buildResume(wb, bp, formData, effectiveLang);
  buildHypotheses(wb, bp, formData, effectiveLang);
  buildMarche(wb, bp, formData, effectiveLang);
  buildClients(wb, bp, formData, effectiveLang);
  buildProduits(wb, bp, formData, effectiveLang);
  buildStrategieCommerciale(wb, bp, formData, effectiveLang);
  buildMarketing(wb, bp, formData, effectiveLang);
  buildRH(wb, bp, formData, effectiveLang);
  buildInvestissement(wb, bp, formData, effectiveLang);
  buildFinancement(wb, bp, formData, effectiveLang);
  buildCAPrevisionnel(wb, bp, formData, effectiveLang);
  buildCharges(wb, bp, formData, effectiveLang);
  buildCPC(wb, bp, formData, effectiveLang);
  buildTresorerie(wb, bp, formData, effectiveLang);
  buildBFR(wb, bp, formData, effectiveLang);
  buildSeuilRentabilite(wb, bp, formData, effectiveLang);
  buildAnalyseFinanciere(wb, bp, formData, effectiveLang);
  buildScenarios(wb, bp, formData, effectiveLang);
  buildConseils(wb, bp, formData, effectiveLang);

  return wb;
}
