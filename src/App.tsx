import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CITY_SUGGESTIONS } from "@/lib/cities";
import { buildResourcePlan, type Availability } from "@/lib/resource-planner";

type StageLabel = "Planning" | "Foundation" | "Structure" | "Services" | "Finishing" | "Completed";

type BaseResult = {
  project_status: "under_construction" | "completed";
  stage_of_construction: StageLabel;
  progress_percent: number;
  timeline: { hours_remaining: number; manpower_hours: number; machinery_hours: number };
  category_matrix: {
    Category: string;
    Typology: string;
    Style: string;
    ClimateAdaptability: string;
    Terrain: string;
    SoilType: string;
    MaterialUsed: string;
    InteriorLayout: string;
    RoofType: string;
    Exterior: string;
    AdditionalFeatures: string;
    Sustainability: string;
  };
  scope: { stages_completed: string[]; stages_left: string[]; dependencies: string[] };
  geo_market_factors: {
    terrain: string;
    soil_condition: string;
    climate_zone: string;
    population_density: string;
    master_plan_zone: string;
    policy_posture: string;
    policy_focus: string;
    comparable_activity: string;
    comparable_properties_count: number;
    city_growth_5y_percent: number;
    property_growth_percent: number;
    land_growth_percent: number;
    property_age_years: number;
    resale_value_percent: number;
    investment_roi_percent: number;
  };
  notes: string[];
};

type AdvancedResult = {
  progress_vs_ideal: "Ahead" | "On Track" | "Delayed";
  timeline_drift: string;
  cost_risk_signals: string[];
  recommendations: string[];
};

type Lang = "EN" | "HI" | "ES" | "FR" | "DE" | "TA" | "TE" | "KN" | "ML" | "MR" | "GU" | "PA" | "ZH" | "JA";

type Currency =
  | "USD"
  | "INR"
  | "AED"
  | "EUR"
  | "GBP"
  | "SGD"
  | "AUD"
  | "CAD"
  | "NZD"
  | "CHF"
  | "SEK"
  | "NOK"
  | "DKK"
  | "ZAR"
  | "JPY"
  | "CNY"
  | "HKD"
  | "SAR"
  | "QAR"
  | "KRW"
  | "THB"
  | "MYR"
  | "IDR"
  | "PHP"
  | "BRL"
  | "MXN"
  | "PLN"
  | "CZK"
  | "TRY";

const STAGE_RANGES = [
  { label: "Planning", min: 0, max: 5 },
  { label: "Foundation", min: 5, max: 20 },
  { label: "Structure", min: 20, max: 55 },
  { label: "Services", min: 55, max: 75 },
  { label: "Finishing", min: 75, max: 95 },
  { label: "Completed", min: 100, max: 100 }
] as const;

const LANGUAGE_LABELS: Record<Lang, Record<string, string>> = {
  EN: {
    title: "Vision",
    subtitle: "Resource Planning",
    engine: "Powered by VitruviAI",
    capture: "Capture + Ingest",
    inputWindow: "Input Window",
    constructionProgress: "Construction Progress",
    executionEstimation: "Execution Estimation",
    resources: "Resources",
    stagesLeft: "Stages Left",
    singleUse: "Single Use",
    stored: "Stored",
    valuationInsights: "Valuation + Insights",
    signals: "Signals",
    progressVsIdeal: "Progress vs Ideal",
    timelineDrift: "Timeline Drift",
    insights: "Insights",
    riskReveal: "Risk Reveal",
    revealRisks: "Reveal Risks",
    assumptions: "Assumptions",
    photoEstimate: "Photo-based estimation only.",
    indicative: "Indicative outputs. Validate on-site.",
    projectType: "Project Type",
    scale: "Scale",
    constructionType: "Construction Type",
    location: "Location",
    notes: "Notes",
    useGps: "Use GPS",
    browse: "Browse",
    live: "Live",
    analyze: "Analyze",
    status: "Status",
    stage: "Stage",
    progress: "Progress",
    manpower: "Manpower",
    machinery: "Machinery",
    used: "Used",
    remaining: "Remaining",
    confidence: "Confidence",
    budgetLeft: "Budget Left",
    budgetUsed: "Budget Used",
    landVal: "Land Val",
    projectVal: "Project Val",
    propertyVal: "Property Valuation",
    awaitingBase: "Awaiting base analysis",
    runRiskReveal: "Run risk reveal to unlock",
    pending: "Pending",
    notAnalyzed: "Not analyzed",
    climateInferred: "Climate inferred from location",
    climateAssumed: "Climate assumed generically",
    weatherSensitive: "Weather-sensitive phase detected",
    structuralOngoing: "Structural execution ongoing",
    pacingApplied: "Mid-rise pacing benchmark applied",
    currency: "Currency",
    language: "Language",
    light: "Light",
    dark: "Dark",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS Off",
    noGps: "No GPS",
    manual: "Manual"
  },
  HI: {
    title: "Vision",
    subtitle: "निर्माण विश्लेषण",
    engine: "VitruviAI द्वारा संचालित",
    capture: "कैप्चर + इनजेस्ट",
    inputWindow: "इनपुट विंडो",
    constructionProgress: "निर्माण प्रगति",
    executionEstimation: "निष्पादन अनुमान",
    resources: "संसाधन",
    stagesLeft: "बाकी चरण",
    singleUse: "सिंगल यूज़",
    stored: "स्टोर किया गया",
    valuationInsights: "वैल्यूएशन + इनसाइट्स",
    signals: "संकेत",
    progressVsIdeal: "आदर्श बनाम प्रगति",
    timelineDrift: "समय विचलन",
    insights: "इनसाइट्स",
    riskReveal: "जोखिम दिखाएँ",
    revealRisks: "जोखिम दिखाएँ",
    assumptions: "मान्यताएँ",
    photoEstimate: "केवल फोटो-आधारित अनुमान।",
    indicative: "संकेतात्मक परिणाम। साइट पर सत्यापित करें।",
    projectType: "प्रोजेक्ट प्रकार",
    scale: "स्केल",
    constructionType: "निर्माण प्रकार",
    location: "स्थान",
    notes: "नोट्स",
    useGps: "GPS उपयोग करें",
    browse: "अपलोड",
    live: "लाइव",
    analyze: "विश्लेषण",
    status: "स्थिति",
    stage: "चरण",
    progress: "प्रगति",
    manpower: "मैनपावर",
    machinery: "मशीनरी",
    confidence: "विश्वास स्तर",
    budgetLeft: "बचा बजट",
    budgetUsed: "खर्च बजट",
    landVal: "भूमि मूल्य",
    projectVal: "प्रोजेक्ट मूल्य",
    propertyVal: "संपत्ति मूल्यांकन",
    awaitingBase: "बेस विश्लेषण लंबित",
    runRiskReveal: "जोखिम दिखाने के लिए चलाएँ",
    pending: "लंबित",
    notAnalyzed: "विश्लेषण नहीं हुआ",
    climateInferred: "लोकेशन से जलवायु अनुमानित",
    climateAssumed: "सामान्य जलवायु मान लिया",
    weatherSensitive: "मौसम-संवेदनशील चरण",
    structuralOngoing: "स्ट्रक्चर कार्य जारी",
    pacingApplied: "मिड-राइज़ गति मानक लागू",
    currency: "मुद्रा",
    language: "भाषा",
    light: "लाइट",
    dark: "डार्क",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS बंद",
    noGps: "GPS नहीं",
    manual: "मैनुअल"
  },
  ES: {
    subtitle: "Análisis de construcción",
    engine: "Impulsado por VitruviAI",
    capture: "Captura + Ingesta",
    inputWindow: "Ventana de entrada",
    constructionProgress: "Progreso de obra",
    executionEstimation: "Estimación de ejecución",
    resources: "Recursos",
    stagesLeft: "Fases restantes",
    singleUse: "Uso único",
    stored: "Almacenado",
    valuationInsights: "Valoración + Insights",
    signals: "Señales",
    progressVsIdeal: "Progreso vs ideal",
    timelineDrift: "Desvío de plazo",
    insights: "Insights",
    riskReveal: "Revelar riesgos",
    revealRisks: "Ver riesgos",
    assumptions: "Supuestos",
    photoEstimate: "Estimación solo con foto.",
    indicative: "Resultados indicativos. Validar en sitio.",
    projectType: "Tipo de proyecto",
    scale: "Escala",
    constructionType: "Tipo constructivo",
    location: "Ubicación",
    notes: "Notas",
    useGps: "Usar GPS",
    browse: "Cargar",
    live: "Vivo",
    analyze: "Analizar",
    status: "Estado",
    stage: "Etapa",
    progress: "Progreso",
    manpower: "Mano de obra",
    machinery: "Maquinaria",
    confidence: "Confianza",
    budgetLeft: "Presupuesto restante",
    budgetUsed: "Presupuesto usado",
    landVal: "Valor del terreno",
    projectVal: "Valor del proyecto",
    propertyVal: "Valoración de propiedad",
    awaitingBase: "Esperando análisis base",
    runRiskReveal: "Ejecuta riesgos para ver",
    pending: "Pendiente",
    notAnalyzed: "No analizado",
    climateInferred: "Clima inferido por ubicación",
    climateAssumed: "Clima asumido",
    weatherSensitive: "Fase sensible al clima",
    structuralOngoing: "Estructura en curso",
    pacingApplied: "Referencia de ritmo mid-rise",
    currency: "Moneda",
    language: "Idioma",
    light: "Claro",
    dark: "Oscuro",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS apagado",
    noGps: "Sin GPS",
    manual: "Manual"
  },
  FR: {
    subtitle: "Analyse de construction",
    engine: "Propulsé par VitruviAI",
    capture: "Capture + Ingestion",
    inputWindow: "Fenêtre d'entrée",
    constructionProgress: "Avancement chantier",
    executionEstimation: "Estimation d'exécution",
    resources: "Ressources",
    stagesLeft: "Étapes restantes",
    singleUse: "Usage unique",
    stored: "Enregistré",
    valuationInsights: "Valorisation + Insights",
    signals: "Signaux",
    progressVsIdeal: "Progrès vs idéal",
    timelineDrift: "Dérive planning",
    insights: "Insights",
    riskReveal: "Révéler les risques",
    revealRisks: "Voir les risques",
    assumptions: "Hypothèses",
    photoEstimate: "Estimation basée sur photo.",
    indicative: "Résultats indicatifs. Vérifier sur site.",
    projectType: "Type de projet",
    scale: "Échelle",
    constructionType: "Type constructif",
    location: "Localisation",
    notes: "Notes",
    useGps: "Utiliser GPS",
    browse: "Importer",
    live: "Live",
    analyze: "Analyser",
    status: "Statut",
    stage: "Étape",
    progress: "Progrès",
    manpower: "Main-d'œuvre",
    machinery: "Machinerie",
    confidence: "Confiance",
    budgetLeft: "Budget restant",
    budgetUsed: "Budget utilisé",
    landVal: "Valeur du terrain",
    projectVal: "Valeur du projet",
    propertyVal: "Valorisation",
    awaitingBase: "En attente d'analyse",
    runRiskReveal: "Lancer les risques pour voir",
    pending: "En attente",
    notAnalyzed: "Non analysé",
    climateInferred: "Climat déduit de la localisation",
    climateAssumed: "Climat supposé",
    weatherSensitive: "Phase sensible au climat",
    structuralOngoing: "Structure en cours",
    pacingApplied: "Référence mid-rise appliquée",
    currency: "Devise",
    language: "Langue",
    light: "Clair",
    dark: "Sombre",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS coupé",
    noGps: "Pas de GPS",
    manual: "Manuel"
  },
  DE: {
    subtitle: "Bauanalyse",
    engine: "Powered by VitruviAI",
    capture: "Erfassung + Eingabe",
    inputWindow: "Eingabefenster",
    constructionProgress: "Baufortschritt",
    executionEstimation: "Ausführungsabschätzung",
    resources: "Ressourcen",
    stagesLeft: "Offene Phasen",
    singleUse: "Einmalnutzung",
    stored: "Gespeichert",
    valuationInsights: "Bewertung + Insights",
    signals: "Signale",
    progressVsIdeal: "Fortschritt vs Ideal",
    timelineDrift: "Terminabweichung",
    insights: "Insights",
    riskReveal: "Risiken anzeigen",
    revealRisks: "Risiken zeigen",
    assumptions: "Annahmen",
    photoEstimate: "Schätzung nur anhand Foto.",
    indicative: "Indikative Ergebnisse. Vor Ort prüfen.",
    projectType: "Projekttyp",
    scale: "Skalierung",
    constructionType: "Bauart",
    location: "Standort",
    notes: "Notizen",
    useGps: "GPS nutzen",
    browse: "Upload",
    live: "Live",
    analyze: "Analysieren",
    status: "Status",
    stage: "Phase",
    progress: "Fortschritt",
    manpower: "Arbeitskraft",
    machinery: "Maschinen",
    confidence: "Sicherheit",
    budgetLeft: "Restbudget",
    budgetUsed: "Budget genutzt",
    landVal: "Grundwert",
    projectVal: "Projektwert",
    propertyVal: "Objektbewertung",
    awaitingBase: "Basisanalyse ausstehend",
    runRiskReveal: "Risiken ausführen, um zu sehen",
    pending: "Ausstehend",
    notAnalyzed: "Nicht analysiert",
    climateInferred: "Klima aus Standort abgeleitet",
    climateAssumed: "Klima angenommen",
    weatherSensitive: "Wetterkritische Phase",
    structuralOngoing: "Strukturphase aktiv",
    pacingApplied: "Mid-rise Referenz genutzt",
    currency: "Währung",
    language: "Sprache",
    light: "Hell",
    dark: "Dunkel",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS aus",
    noGps: "Kein GPS",
    manual: "Manuell"
  },
  TA: {
    subtitle: "கட்டிடம் பகுப்பாய்வு",
    engine: "VitruviAI இயந்திரம்",
    capture: "பிடிப்பு + உள்ளீடு",
    inputWindow: "உள்ளீட்டு சாளரம்",
    constructionProgress: "கட்டுமான முன்னேற்றம்",
    executionEstimation: "நிறைவேற்ற மதிப்பீடு",
    resources: "வளங்கள்",
    stagesLeft: "மீதமுள்ள கட்டங்கள்",
    singleUse: "ஒருமுறை பயன்பாடு",
    stored: "சேமிக்கப்பட்டது",
    valuationInsights: "மதிப்பீடு + குறிப்புகள்",
    signals: "சிக்னல்கள்",
    progressVsIdeal: "இயல்புடன் ஒப்பீடு",
    timelineDrift: "கால அசைவுகள்",
    insights: "குறிப்புகள்",
    riskReveal: "ஆபத்து காண்க",
    revealRisks: "ஆபத்து காண்க",
    assumptions: "கருதுகோள்கள்",
    photoEstimate: "படத்தை மட்டும் வைத்து மதிப்பீடு.",
    indicative: "கணிசமான முடிவுகள். தளத்தில் சரிபார்க்கவும்.",
    projectType: "திட்ட வகை",
    scale: "அளவு",
    constructionType: "கட்டுமான வகை",
    location: "இடம்",
    notes: "குறிப்புகள்",
    useGps: "GPS பயன்படுத்து",
    browse: "அப்லோடு",
    live: "நேரடி",
    analyze: "பகுப்பு",
    status: "நிலை",
    stage: "கட்டம்",
    progress: "முன்னேற்றம்",
    manpower: "மனோபவர்",
    machinery: "இயந்திரங்கள்",
    confidence: "நம்பிக்கை",
    budgetLeft: "மீதமுள்ள பட்ஜெட்",
    budgetUsed: "பயன்பட்ட பட்ஜெட்",
    landVal: "நில மதிப்பு",
    projectVal: "திட்ட மதிப்பு",
    propertyVal: "சொத்து மதிப்பீடு",
    awaitingBase: "அடிப்படை பகுப்பாய்வு காத்திருப்பு",
    runRiskReveal: "ஆபத்து காண இயக்கவும்",
    pending: "நிலுவையில்",
    notAnalyzed: "பகுப்பாய்வு இல்லை",
    climateInferred: "இடத்தின் அடிப்படையில் காலநிலை",
    climateAssumed: "பொது காலநிலை கருதப்பட்டது",
    weatherSensitive: "வானிலை சென்சிடிவ் கட்டம்",
    structuralOngoing: "ஸ்ட்ரக்சர் வேலை நடைபெறுகிறது",
    pacingApplied: "மிட்-ரைஸ் அளவீடு பயன்படுத்தப்பட்டது",
    currency: "நாணயம்",
    language: "மொழி",
    light: "லைட்",
    dark: "டார்க்",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS ஆஃப்",
    noGps: "GPS இல்லை",
    manual: "கையேடு"
  },
  TE: {
    subtitle: "నిర్మాణ విశ్లేషణ",
    engine: "VitruviAI ఇంజిన్",
    capture: "క్యాప్చర్ + ఇన్పుట్",
    inputWindow: "ఇన్పుట్ విండో",
    constructionProgress: "నిర్మాణ పురోగతి",
    executionEstimation: "నిర్వహణ అంచనా",
    resources: "వనరులు",
    stagesLeft: "మిగిలిన దశలు",
    singleUse: "ఒకసారి ఉపయోగం",
    stored: "సేవ్ అయ్యింది",
    valuationInsights: "విలువ + సూచనలు",
    signals: "సిగ్నల్స్",
    progressVsIdeal: "ఆదర్శంతో పోలిక",
    timelineDrift: "టైమ్ డ్రిఫ్ట్",
    insights: "సూచనలు",
    riskReveal: "రిస్క్ చూపు",
    revealRisks: "రిస్క్ చూపు",
    assumptions: "అంచనాలు",
    photoEstimate: "ఫోటో ఆధారిత అంచనా మాత్రమే.",
    indicative: "సూచనాత్మక ఫలితాలు. సైట్‌లో తనిఖీ చేయండి.",
    projectType: "ప్రాజెక్ట్ టైప్",
    scale: "స్కేల్",
    constructionType: "నిర్మాణ టైప్",
    location: "స్థానం",
    notes: "నోట్స్",
    useGps: "GPS ఉపయోగించు",
    browse: "అప్‌లోడ్",
    live: "లైవ్",
    analyze: "విశ్లేషణ",
    status: "స్థితి",
    stage: "దశ",
    progress: "పురోగతి",
    manpower: "మ్యాన్‌పవర్",
    machinery: "యంత్రాలు",
    confidence: "నమ్మకం",
    budgetLeft: "మిగిలిన బడ్జెట్",
    budgetUsed: "ఖర్చైన బడ్జెట్",
    landVal: "భూమి విలువ",
    projectVal: "ప్రాజెక్ట్ విలువ",
    propertyVal: "ఆస్తి విలువ",
    awaitingBase: "బేస్ విశ్లేషణ కోసం వేచి ఉంది",
    runRiskReveal: "రిస్క్ చూపడానికి రన్ చేయండి",
    pending: "పెండింగ్",
    notAnalyzed: "విశ్లేషణ లేదు",
    climateInferred: "లొకేషన్ ఆధారంగా క్లైమేట్",
    climateAssumed: "సాధారణ క్లైమేట్ అంచనా",
    weatherSensitive: "వాతావరణానికి సున్నితమైన దశ",
    structuralOngoing: "స్ట్రక్చర్ వర్క్ కొనసాగుతోంది",
    pacingApplied: "మిడ్-రైజ్ బెంచ్‌మార్క్ వర్తించింది",
    currency: "కరెన్సీ",
    language: "భాష",
    light: "లైట్",
    dark: "డార్క్",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS ఆఫ్",
    noGps: "GPS లేదు",
    manual: "మాన్యువల్"
  },
  KN: {
    subtitle: "ನಿರ್ಮಾಣ ವಿಶ್ಲೇಷಣೆ",
    engine: "VitruviAI ಎಂಜಿನ್",
    capture: "ಕ್ಯಾಪ್ಚರ್ + ಇನ್‌ಪುಟ್",
    inputWindow: "ಇನ್‌ಪುಟ್ ವಿಂಡೋ",
    constructionProgress: "ನಿರ್ಮಾಣ ಪ್ರಗತಿ",
    executionEstimation: "ಕಾರ್ಯನಿರ್ವಹಣೆ ಅಂದಾಜು",
    resources: "ಸಂಪನ್ಮೂಲಗಳು",
    stagesLeft: "ಉಳಿದ ಹಂತಗಳು",
    singleUse: "ಒಮ್ಮೆ ಬಳಕೆ",
    stored: "ಸೇವ್ ಆಗಿದೆ",
    valuationInsights: "ಮೌಲ್ಯಮಾಪನ + ಇನ್ಸೈಟ್ಸ್",
    signals: "ಸಿಗ್ನಲ್ಸ್",
    progressVsIdeal: "ಆದರ್ಶದೊಂದಿಗೆ ಹೋಲಿಕೆ",
    timelineDrift: "ಟೈಮ್ಲೈನ್ ಡ್ರಿಫ್ಟ್",
    insights: "ಇನ್ಸೈಟ್ಸ್",
    riskReveal: "ರಿಸ್ಕ್ ತೋರಿಸಿ",
    revealRisks: "ರಿಸ್ಕ್ ತೋರಿಸಿ",
    assumptions: "ಅಂದಾಜುಗಳು",
    photoEstimate: "ಫೋಟೋ ಆಧಾರಿತ ಅಂದಾಜು ಮಾತ್ರ.",
    indicative: "ಸೂಚಕ ಫಲಿತಾಂಶಗಳು. ಸೈಟ್‌ನಲ್ಲಿ ಪರಿಶೀಲಿಸಿ.",
    projectType: "ಪ್ರಾಜೆಕ್ಟ್ ಟೈಪ್",
    scale: "ಸ್ಕೇಲ್",
    constructionType: "ಕಾನ್ಸ್ಟ್ರಕ್ಷನ್ ಟೈಪ್",
    location: "ಸ್ಥಳ",
    notes: "ನೋಟ್ಸ್",
    useGps: "GPS ಬಳಸಿ",
    browse: "ಅಪ್ಲೋಡ್",
    live: "ಲೈವ್",
    analyze: "ವಿಶ್ಲೇಷಣೆ",
    status: "ಸ್ಥಿತಿ",
    stage: "ಹಂತ",
    progress: "ಪ್ರಗತಿ",
    manpower: "ಮ್ಯಾನ್ಪವರ್",
    machinery: "ಯಂತ್ರಗಳು",
    confidence: "ನಂಬಿಕೆ",
    budgetLeft: "ಉಳಿದ ಬಜೆಟ್",
    budgetUsed: "ಬಳಸಿದ ಬಜೆಟ್",
    landVal: "ಭೂಮಿ ಮೌಲ್ಯ",
    projectVal: "ಪ್ರಾಜೆಕ್ಟ್ ಮೌಲ್ಯ",
    propertyVal: "ಆಸ್ತಿ ಮೌಲ್ಯ",
    awaitingBase: "ಬೇಸ್ ವಿಶ್ಲೇಷಣೆಗೆ ಕಾಯುತ್ತಿದೆ",
    runRiskReveal: "ರಿಸ್ಕ್ ನೋಡಲು ರನ್ ಮಾಡಿ",
    pending: "ಪೆಂಡಿಂಗ್",
    notAnalyzed: "ವಿಶ್ಲೇಷಣೆ ಇಲ್ಲ",
    climateInferred: "ಸ್ಥಳದಿಂದ ಹವಾಮಾನ ಅಂದಾಜು",
    climateAssumed: "ಸಾಮಾನ್ಯ ಹವಾಮಾನ ಅಂದಾಜು",
    weatherSensitive: "ಹವಾಮಾನ ಸಂವೇದನಾಶೀಲ ಹಂತ",
    structuralOngoing: "ಸ್ಟ್ರಕ್ಚರ್ ಕೆಲಸ ನಡೆಯುತ್ತಿದೆ",
    pacingApplied: "ಮಿಡ್-ರೈಸ್ ಬೆಂಚ್ಮಾರ್ಕ್ ಅನ್ವಯಿಸಲಾಗಿದೆ",
    currency: "ಕರೆನ್ಸಿ",
    language: "ಭಾಷೆ",
    light: "ಲೈಟ್",
    dark: "ಡಾರ್ಕ್",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS ಆಫ್",
    noGps: "GPS ಇಲ್ಲ",
    manual: "ಮಾನುವಲ್"
  },
  ML: {
    subtitle: "നിർമാണ വിശകലനം",
    engine: "VitruviAI എൻജിൻ",
    capture: "ക്യാപ്ചർ + ഇൻപുട്ട്",
    inputWindow: "ഇൻപുട്ട് വിൻഡോ",
    constructionProgress: "നിർമാണ പുരോഗതി",
    executionEstimation: "നിർവഹണ അനുമാനം",
    resources: "വിഭവങ്ങൾ",
    stagesLeft: "ബാക്കി ഘട്ടങ്ങൾ",
    singleUse: "ഒറ്റ ഉപയോഗം",
    stored: "സേവ് ചെയ്തു",
    valuationInsights: "വിലയിരുത്തൽ + ഇൻസൈറ്റ്സ്",
    signals: "സിഗ്നലുകൾ",
    progressVsIdeal: "ഇഡിയൽ താരതമ്യം",
    timelineDrift: "ടൈംലൈൻ ഡ്രിഫ്റ്റ്",
    insights: "ഇൻസൈറ്റ്സ്",
    riskReveal: "റിസ്ക് കാണിക്കുക",
    revealRisks: "റിസ്ക് കാണിക്കുക",
    assumptions: "അനുമാനങ്ങൾ",
    photoEstimate: "ഫോട്ടോ അടിസ്ഥാനമാക്കിയുള്ള വിലയിരുത്തൽ മാത്രം.",
    indicative: "സൂചനാത്മക ഫലങ്ങൾ. സൈറ്റിൽ പരിശോധിക്കുക.",
    projectType: "പ്രോജക്റ്റ് തരം",
    scale: "സ്കെയിൽ",
    constructionType: "നിർമാണ തരം",
    location: "സ്ഥലം",
    notes: "നോട്ട്സ്",
    useGps: "GPS ഉപയോഗിക്കുക",
    browse: "അപ്‌ലോഡ്",
    live: "ലൈവ്",
    analyze: "വിശകലനം",
    status: "സ്റ്റാറ്റസ്",
    stage: "ഘട്ടം",
    progress: "പുരോഗതി",
    manpower: "മാൻപവർ",
    machinery: "മെഷിനറി",
    confidence: "വിശ്വാസം",
    budgetLeft: "ബാക്കി ബജറ്റ്",
    budgetUsed: "ഉപയോഗിച്ച ബജറ്റ്",
    landVal: "ഭൂമി മൂല്യം",
    projectVal: "പ്രോജക്റ്റ് മൂല്യം",
    propertyVal: "സ്വത്ത് മൂല്യം",
    awaitingBase: "ബേസ് വിശകലനം കാത്തിരിക്കുന്നു",
    runRiskReveal: "റിസ്ക് കാണാൻ റൺ ചെയ്യുക",
    pending: "പെൻഡിങ്",
    notAnalyzed: "വിശകലനം ഇല്ല",
    climateInferred: "ലൊക്കേഷൻ അടിസ്ഥാനത്തിൽ കാലാവസ്ഥ",
    climateAssumed: "സാധാരണ കാലാവസ്ഥ അനുമാനം",
    weatherSensitive: "കാലാവസ്ഥയ്ക്ക് സെൻസിറ്റീവ് ഘട്ടം",
    structuralOngoing: "സ്ട്രക്ചർ ജോലി നടക്കുന്നു",
    pacingApplied: "മിഡ്-റൈസ് ബെഞ്ച്മാർക്ക് പ്രയോഗിച്ചു",
    currency: "കറൻസി",
    language: "ഭാഷ",
    light: "ലൈറ്റ്",
    dark: "ഡാർക്ക്",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS ഓഫ്",
    noGps: "GPS ഇല്ല",
    manual: "മാനുവൽ"
  },
  MR: {
    subtitle: "बांधकाम विश्लेषण",
    engine: "VitruviAI इंजिन",
    capture: "कॅप्चर + इनपुट",
    inputWindow: "इनपुट विंडो",
    constructionProgress: "बांधकाम प्रगती",
    executionEstimation: "अंमलबजावणी अंदाज",
    resources: "संसाधने",
    stagesLeft: "उर्वरित टप्पे",
    singleUse: "एकदाच वापर",
    stored: "जतन केले",
    valuationInsights: "मूल्यांकन + इनसाइट्स",
    signals: "सिग्नल्स",
    progressVsIdeal: "आदर्शाशी तुलना",
    timelineDrift: "टाइमलाइन ड्रिफ्ट",
    insights: "इनसाइट्स",
    riskReveal: "धोका दाखवा",
    revealRisks: "धोका दाखवा",
    assumptions: "गृहितके",
    photoEstimate: "फोटो-आधारित अंदाज.",
    indicative: "सूचक परिणाम. साइटवर तपासा.",
    projectType: "प्रकल्प प्रकार",
    scale: "स्केल",
    constructionType: "बांधकाम प्रकार",
    location: "स्थान",
    notes: "नोट्स",
    useGps: "GPS वापरा",
    browse: "अपलोड",
    live: "लाइव्ह",
    analyze: "विश्लेषण",
    status: "स्थिती",
    stage: "टप्पा",
    progress: "प्रगती",
    manpower: "मनपावर",
    machinery: "यंत्रे",
    confidence: "विश्वास",
    budgetLeft: "उरलेले बजेट",
    budgetUsed: "वापरलेला बजेट",
    landVal: "जमीन मूल्य",
    projectVal: "प्रकल्प मूल्य",
    propertyVal: "मालमत्ता मूल्य",
    awaitingBase: "बेस विश्लेषण प्रतीक्षेत",
    runRiskReveal: "धोका पाहण्यासाठी चालवा",
    pending: "प्रलंबित",
    notAnalyzed: "विश्लेषण नाही",
    climateInferred: "स्थानावरून हवामान अंदाज",
    climateAssumed: "सामान्य हवामान गृहित",
    weatherSensitive: "हवामान संवेदनशील टप्पा",
    structuralOngoing: "स्ट्रक्चर काम सुरू आहे",
    pacingApplied: "मिड-राईज मानक लागू",
    currency: "चलन",
    language: "भाषा",
    light: "लाइट",
    dark: "डार्क",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS बंद",
    noGps: "GPS नाही",
    manual: "मॅन्युअल"
  },
  GU: {
    subtitle: "બાંધકામ વિશ્લેષણ",
    engine: "VitruviAI એન્જિન",
    capture: "કૅપ્ચર + ઇનપુટ",
    inputWindow: "ઇનપુટ વિન્ડો",
    constructionProgress: "બાંધકામ પ્રગતિ",
    executionEstimation: "અનુમાનિત અમલ",
    resources: "સ્રોતો",
    stagesLeft: "બાકી તબક્કા",
    singleUse: "એક વખત ઉપયોગ",
    stored: "સેવ કરેલું",
    valuationInsights: "મૂલ્યાંકન + ઇનસાઇટ્સ",
    signals: "સિગ્નલ્સ",
    progressVsIdeal: "આદર્શની તુલના",
    timelineDrift: "ટાઇમલાઇન ડ્રિફ્ટ",
    insights: "ઇનસાઇટ્સ",
    riskReveal: "જોખમ બતાવો",
    revealRisks: "જોખમ બતાવો",
    assumptions: "ધારણાઓ",
    photoEstimate: "ફોટો આધારિત અંદાજ.",
    indicative: "સૂચક પરિણામો. સાઇટ પર ચકાસો.",
    projectType: "પ્રોજેક્ટ પ્રકાર",
    scale: "સ્કેલ",
    constructionType: "બાંધકામ પ્રકાર",
    location: "સ્થાન",
    notes: "નોંધો",
    useGps: "GPS ઉપયોગ કરો",
    browse: "અપલોડ",
    live: "લાઇવ",
    analyze: "વિશ્લેષણ",
    status: "સ્થિતિ",
    stage: "તબક્કો",
    progress: "પ્રગતિ",
    manpower: "મેનપાવર",
    machinery: "યંત્રો",
    confidence: "વિશ્વાસ",
    budgetLeft: "બાકી બજેટ",
    budgetUsed: "ઉપયોગ કરેલો બજેટ",
    landVal: "જમીન મૂલ્ય",
    projectVal: "પ્રોજેક્ટ મૂલ્ય",
    propertyVal: "મિલકત મૂલ્ય",
    awaitingBase: "બેઝ વિશ્લેષણ માટે રાહ",
    runRiskReveal: "જોખમ જોવા માટે ચલાવો",
    pending: "બાકી",
    notAnalyzed: "વિશ્લેષણ નથી",
    climateInferred: "સ્થાન આધારિત હવામાન",
    climateAssumed: "સામાન્ય હવામાન ધાર્યું",
    weatherSensitive: "હવામાન સંવેદનશીલ તબક્કો",
    structuralOngoing: "સ્ટ્રક્ચર કામ ચાલુ છે",
    pacingApplied: "મિડ-રાઈઝ બેન્ચમાર્ક લાગુ",
    currency: "ચલણ",
    language: "ભાષા",
    light: "લાઇટ",
    dark: "ડાર્ક",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS બંધ",
    noGps: "GPS નથી",
    manual: "મેન્યુઅલ"
  },
  PA: {
    subtitle: "ਨਿਰਮਾਣ ਵਿਸ਼ਲੇਸ਼ਣ",
    engine: "VitruviAI ਇੰਜਨ",
    capture: "ਕੈਪਚਰ + ਇਨਪੁਟ",
    inputWindow: "ਇਨਪੁਟ ਵਿੰਡੋ",
    constructionProgress: "ਨਿਰਮਾਣ ਪ੍ਰਗਤੀ",
    executionEstimation: "ਕਾਰਜ ਅੰਦਾਜ਼ਾ",
    resources: "ਸਰੋਤ",
    stagesLeft: "ਬਾਕੀ ਪੜਾਅ",
    singleUse: "ਇੱਕ ਵਾਰ ਵਰਤੋਂ",
    stored: "ਸੇਵ ਕੀਤਾ",
    valuationInsights: "ਮੁੱਲਾਂਕਨ + ਇਨਸਾਈਟਸ",
    signals: "ਸਿਗਨਲ",
    progressVsIdeal: "ਆਦਰਸ਼ ਨਾਲ ਤੁਲਨਾ",
    timelineDrift: "ਟਾਈਮਲਾਈਨ ਡ੍ਰਿਫਟ",
    insights: "ਇਨਸਾਈਟਸ",
    riskReveal: "ਖਤਰਾ ਵੇਖੋ",
    revealRisks: "ਖਤਰਾ ਵੇਖੋ",
    assumptions: "ਅਨੁਮਾਨ",
    photoEstimate: "ਸਿਰਫ਼ ਫੋਟੋ ਆਧਾਰਿਤ ਅੰਦਾਜ਼ਾ।",
    indicative: "ਸੰਕੇਤਕ ਨਤੀਜੇ। ਸਾਈਟ ਤੇ ਚੈੱਕ ਕਰੋ।",
    projectType: "ਪਰੋਜੈਕਟ ਕਿਸਮ",
    scale: "ਸਕੇਲ",
    constructionType: "ਨਿਰਮਾਣ ਕਿਸਮ",
    location: "ਥਾਂ",
    notes: "ਨੋਟਸ",
    useGps: "GPS ਵਰਤੋਂ",
    browse: "ਅਪਲੋਡ",
    live: "ਲਾਈਵ",
    analyze: "ਵਿਸ਼ਲੇਸ਼ਣ",
    status: "ਹਾਲਤ",
    stage: "ਪੜਾਅ",
    progress: "ਪ੍ਰਗਤੀ",
    manpower: "ਮੈਨਪਾਵਰ",
    machinery: "ਮਸ਼ੀਨਰੀ",
    confidence: "ਭਰੋਸਾ",
    budgetLeft: "ਬਾਕੀ ਬਜਟ",
    budgetUsed: "ਵਰਤਿਆ ਬਜਟ",
    landVal: "ਜਮੀਨ ਮੁੱਲ",
    projectVal: "ਪਰੋਜੈਕਟ ਮੁੱਲ",
    propertyVal: "ਸੰਪਤੀ ਮੁੱਲ",
    awaitingBase: "ਬੇਸ ਵਿਸ਼ਲੇਸ਼ਣ ਦੀ ਉਡੀਕ",
    runRiskReveal: "ਖਤਰਾ ਦੇਖਣ ਲਈ ਚਲਾਓ",
    pending: "ਬਾਕੀ",
    notAnalyzed: "ਵਿਸ਼ਲੇਸ਼ਣ ਨਹੀਂ",
    climateInferred: "ਥਾਂ ਤੋਂ ਹਵਾਮਾਨ ਅੰਦਾਜ਼ਾ",
    climateAssumed: "ਆਮ ਹਵਾਮਾਨ ਮੰਨਿਆ",
    weatherSensitive: "ਮੌਸਮ ਸੰਵੇਦਨਸ਼ੀਲ ਪੜਾਅ",
    structuralOngoing: "ਸਟਰਕਚਰ ਕੰਮ ਚੱਲ ਰਿਹਾ",
    pacingApplied: "ਮਿਡ-ਰਾਈਜ਼ ਬੈਂਚਮਾਰਕ ਲਾਗੂ",
    currency: "ਮੁਦਰਾ",
    language: "ਭਾਸ਼ਾ",
    light: "ਲਾਈਟ",
    dark: "ਡਾਰਕ",
    highContrast: "HC",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS ਬੰਦ",
    noGps: "GPS ਨਹੀਂ",
    manual: "ਮੈਨੁਅਲ"
  },
  ZH: {
    subtitle: "施工分析",
    engine: "由 VitruviAI 驱动",
    capture: "采集 + 输入",
    inputWindow: "输入窗口",
    constructionProgress: "施工进度",
    executionEstimation: "执行估算",
    resources: "资源",
    stagesLeft: "剩余阶段",
    singleUse: "单次使用",
    stored: "已保存",
    valuationInsights: "估值 + 见解",
    signals: "信号",
    progressVsIdeal: "进度对比",
    timelineDrift: "工期偏差",
    insights: "见解",
    riskReveal: "风险揭示",
    revealRisks: "查看风险",
    assumptions: "假设",
    photoEstimate: "仅基于照片估算。",
    indicative: "仅供参考，请现场核实。",
    projectType: "项目类型",
    scale: "规模",
    constructionType: "结构类型",
    location: "位置",
    notes: "备注",
    useGps: "使用 GPS",
    browse: "上传",
    live: "现场",
    analyze: "分析",
    status: "状态",
    stage: "阶段",
    progress: "进度",
    manpower: "人力",
    machinery: "机械",
    confidence: "置信度",
    budgetLeft: "剩余预算",
    budgetUsed: "已用预算",
    landVal: "土地估值",
    projectVal: "项目估值",
    propertyVal: "资产估值",
    awaitingBase: "等待基础分析",
    runRiskReveal: "运行风险以查看",
    pending: "待处理",
    notAnalyzed: "未分析",
    climateInferred: "基于位置推断气候",
    climateAssumed: "采用通用气候假设",
    weatherSensitive: "天气敏感阶段",
    structuralOngoing: "结构施工进行中",
    pacingApplied: "采用中高层基准",
    currency: "货币",
    language: "语言",
    light: "浅色",
    dark: "深色",
    highContrast: "高对比",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS 关闭",
    noGps: "无 GPS",
    manual: "手动"
  },
  JA: {
    subtitle: "建設分析",
    engine: "VitruviAI エンジン",
    capture: "撮影 + 入力",
    inputWindow: "入力ウィンドウ",
    constructionProgress: "施工進捗",
    executionEstimation: "実行見積り",
    resources: "リソース",
    stagesLeft: "残り工程",
    singleUse: "単回使用",
    stored: "保存済み",
    valuationInsights: "評価 + インサイト",
    signals: "シグナル",
    progressVsIdeal: "理想との差",
    timelineDrift: "工程のズレ",
    insights: "インサイト",
    riskReveal: "リスク表示",
    revealRisks: "リスクを見る",
    assumptions: "前提",
    photoEstimate: "写真ベースの推定のみ。",
    indicative: "参考値です。現地確認を推奨。",
    projectType: "プロジェクト種別",
    scale: "規模",
    constructionType: "構造種別",
    location: "場所",
    notes: "メモ",
    useGps: "GPS を使用",
    browse: "アップロード",
    live: "ライブ",
    analyze: "解析",
    status: "状態",
    stage: "工程",
    progress: "進捗",
    manpower: "人員",
    machinery: "機械",
    confidence: "信頼度",
    budgetLeft: "残予算",
    budgetUsed: "使用済み予算",
    landVal: "土地評価",
    projectVal: "プロジェクト評価",
    propertyVal: "物件評価",
    awaitingBase: "ベース分析待ち",
    runRiskReveal: "リスク表示を実行",
    pending: "保留",
    notAnalyzed: "未解析",
    climateInferred: "位置情報から気候推定",
    climateAssumed: "一般的な気候仮定",
    weatherSensitive: "天候影響のある工程",
    structuralOngoing: "構造工程進行中",
    pacingApplied: "中高層ベンチマーク適用",
    currency: "通貨",
    language: "言語",
    light: "ライト",
    dark: "ダーク",
    highContrast: "高コントラスト",
    gps: "GPS",
    exif: "EXIF",
    gpsOff: "GPS オフ",
    noGps: "GPS なし",
    manual: "手動"
  }
};

const CURRENCY_LABELS: Record<Currency, { code: Currency; name: string; locale: string }> = {
  USD: { code: "USD", name: "US Dollar", locale: "en-US" },
  INR: { code: "INR", name: "Indian Rupee", locale: "hi-IN" },
  AED: { code: "AED", name: "UAE Dirham", locale: "en-AE" },
  EUR: { code: "EUR", name: "Euro", locale: "fr-FR" },
  GBP: { code: "GBP", name: "British Pound", locale: "en-GB" },
  SGD: { code: "SGD", name: "Singapore Dollar", locale: "en-SG" },
  AUD: { code: "AUD", name: "Australian Dollar", locale: "en-AU" },
  CAD: { code: "CAD", name: "Canadian Dollar", locale: "en-CA" },
  NZD: { code: "NZD", name: "New Zealand Dollar", locale: "en-NZ" },
  CHF: { code: "CHF", name: "Swiss Franc", locale: "de-CH" },
  SEK: { code: "SEK", name: "Swedish Krona", locale: "sv-SE" },
  NOK: { code: "NOK", name: "Norwegian Krone", locale: "nb-NO" },
  DKK: { code: "DKK", name: "Danish Krone", locale: "da-DK" },
  ZAR: { code: "ZAR", name: "South African Rand", locale: "en-ZA" },
  JPY: { code: "JPY", name: "Japanese Yen", locale: "ja-JP" },
  CNY: { code: "CNY", name: "Chinese Yuan", locale: "zh-CN" },
  HKD: { code: "HKD", name: "Hong Kong Dollar", locale: "en-HK" },
  SAR: { code: "SAR", name: "Saudi Riyal", locale: "ar-SA" },
  QAR: { code: "QAR", name: "Qatari Riyal", locale: "ar-QA" },
  KRW: { code: "KRW", name: "South Korean Won", locale: "ko-KR" },
  THB: { code: "THB", name: "Thai Baht", locale: "th-TH" },
  MYR: { code: "MYR", name: "Malaysian Ringgit", locale: "ms-MY" },
  IDR: { code: "IDR", name: "Indonesian Rupiah", locale: "id-ID" },
  PHP: { code: "PHP", name: "Philippine Peso", locale: "en-PH" },
  BRL: { code: "BRL", name: "Brazilian Real", locale: "pt-BR" },
  MXN: { code: "MXN", name: "Mexican Peso", locale: "es-MX" },
  PLN: { code: "PLN", name: "Polish Zloty", locale: "pl-PL" },
  CZK: { code: "CZK", name: "Czech Koruna", locale: "cs-CZ" },
  TRY: { code: "TRY", name: "Turkish Lira", locale: "tr-TR" }
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;

const LANGUAGE_OPTIONS: { value: Lang; label: string }[] = [
  { value: "EN", label: "English" },
  { value: "HI", label: "Hindi" },
  { value: "ES", label: "Spanish" },
  { value: "FR", label: "French" },
  { value: "DE", label: "German" },
  { value: "TA", label: "Tamil" },
  { value: "TE", label: "Telugu" },
  { value: "KN", label: "Kannada" },
  { value: "ML", label: "Malayalam" },
  { value: "MR", label: "Marathi" },
  { value: "GU", label: "Gujarati" },
  { value: "PA", label: "Punjabi" },
  { value: "ZH", label: "Chinese" },
  { value: "JA", label: "Japanese" }
];

type RatesPayload = { base: Currency; rates: Record<string, number>; updatedAt?: number };
type NumericRange = { min: number; max: number };
type DetectedColor = { hex: string; name: string; share: number };

const COLOR_REFERENCE: { name: string; rgb: [number, number, number] }[] = [
  { name: "White", rgb: [245, 245, 245] },
  { name: "Black", rgb: [35, 35, 35] },
  { name: "Gray", rgb: [130, 130, 130] },
  { name: "Silver", rgb: [192, 192, 192] },
  { name: "Brown", rgb: [121, 85, 72] },
  { name: "Beige", rgb: [210, 180, 140] },
  { name: "Red", rgb: [198, 40, 40] },
  { name: "Orange", rgb: [245, 124, 0] },
  { name: "Yellow", rgb: [253, 216, 53] },
  { name: "Green", rgb: [56, 142, 60] },
  { name: "Blue", rgb: [30, 136, 229] },
  { name: "Navy", rgb: [21, 67, 96] },
  { name: "Teal", rgb: [0, 137, 123] },
  { name: "Purple", rgb: [123, 31, 162] },
  { name: "Pink", rgb: [233, 30, 99] }
];

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function toRange(value: number, spread: number, minFloor = 0): NumericRange {
  const centered = Number.isFinite(value) ? value : 0;
  const delta = Math.max(centered * spread, centered < 10 ? 1 : 0.5);
  return {
    min: Math.max(minFloor, centered - delta),
    max: Math.max(minFloor, centered + delta)
  };
}

function clampRange(range: NumericRange, min: number, max: number): NumericRange {
  return {
    min: clampNumber(range.min, min, max),
    max: clampNumber(range.max, min, max)
  };
}

function formatNumberRange(range: NumericRange, decimals = 0) {
  const min = Number(range.min.toFixed(decimals));
  const max = Number(range.max.toFixed(decimals));
  return `${min.toLocaleString()}-${max.toLocaleString()}`;
}

function formatUnitRange(range: NumericRange, unit: string, decimals = 0) {
  return `${formatNumberRange(range, decimals)} ${unit}`;
}

function convertFromUsd(currency: Currency, amountUsd: number, rates: RatesPayload | null) {
  if (!rates || !rates.rates) return "—";
  const usdRate = rates.rates["USD"];
  const targetRate = rates.rates[currency];
  if (!targetRate) return "—";
  const baseAmount = rates.base === "USD" ? 1 : usdRate ? 1 / usdRate : null;
  if (!baseAmount) return "—";
  const amountInBase = rates.base === "USD" ? amountUsd : amountUsd * baseAmount;
  return amountInBase * targetRate;
}

function formatCurrencyRange(currency: Currency, rangeUsd: NumericRange, rates: RatesPayload | null) {
  const convertedMin = convertFromUsd(currency, rangeUsd.min, rates);
  const convertedMax = convertFromUsd(currency, rangeUsd.max, rates);
  if (convertedMin === "—" || convertedMax === "—") return "—";
  const low = Math.min(convertedMin, convertedMax);
  const high = Math.max(convertedMin, convertedMax);
  const maxAbs = Math.max(Math.abs(low), Math.abs(high));
  const useCompact = maxAbs >= 100_000_000;
  const fmt = new Intl.NumberFormat(CURRENCY_LABELS[currency].locale, {
    style: "currency",
    currency,
    notation: useCompact ? "compact" : "standard",
    maximumFractionDigits: useCompact ? 1 : 0
  });
  return `${fmt.format(low)} - ${fmt.format(high)}`;
}

function compactWords(value?: string, maxWords = 2) {
  if (!value) return "-";
  return value
    .replace(/[\n\r]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, maxWords)
    .join(" ");
}

function cleanSentence(value: string, maxLength = 120) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { s, v };
}

function nearestColorName(r: number, g: number, b: number) {
  let best = COLOR_REFERENCE[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const color of COLOR_REFERENCE) {
    const dr = r - color.rgb[0];
    const dg = g - color.rgb[1];
    const db = b - color.rgb[2];
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = color;
    }
  }
  return best.name;
}

async function extractDominantColors(imageUrl: string, limit = 5): Promise<DetectedColor[]> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const maxSide = 160;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve([]);
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        const pixels = ctx.getImageData(0, 0, width, height).data;
        const xStart = Math.floor(width * 0.14);
        const xEnd = Math.ceil(width * 0.86);
        const yStart = Math.floor(height * 0.14);
        const yEnd = Math.ceil(height * 0.86);

        const samples: Array<{ r: number; g: number; b: number }> = [];
        for (let y = yStart; y < yEnd; y += 1) {
          for (let x = xStart; x < xEnd; x += 1) {
            const idx = (y * width + x) * 4;
            const alpha = pixels[idx + 3];
            if (alpha < 170) continue;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const { s, v } = rgbToHsv(r, g, b);
            if (v < 0.06 || v > 0.97) continue;
            if (s < 0.04 && (v < 0.2 || v > 0.93)) continue;
            samples.push({ r, g, b });
          }
        }

        if (!samples.length) {
          resolve([]);
          return;
        }

        const clusterCount = Math.max(3, Math.min(limit + 2, samples.length, 8));
        const stride = Math.max(1, Math.floor(samples.length / clusterCount));
        let centroids = Array.from({ length: clusterCount }, (_, idx) => {
          const seed = samples[Math.min(samples.length - 1, idx * stride)];
          return { r: seed.r, g: seed.g, b: seed.b };
        });

        for (let pass = 0; pass < 5; pass += 1) {
          const sum = Array.from({ length: clusterCount }, () => ({ r: 0, g: 0, b: 0, count: 0 }));
          for (const sample of samples) {
            let bestIdx = 0;
            let bestDistance = Number.POSITIVE_INFINITY;
            for (let i = 0; i < centroids.length; i += 1) {
              const center = centroids[i];
              const distance = (sample.r - center.r) ** 2 + (sample.g - center.g) ** 2 + (sample.b - center.b) ** 2;
              if (distance < bestDistance) {
                bestDistance = distance;
                bestIdx = i;
              }
            }
            const bucket = sum[bestIdx];
            bucket.r += sample.r;
            bucket.g += sample.g;
            bucket.b += sample.b;
            bucket.count += 1;
          }
          centroids = centroids.map((center, idx) => {
            const bucket = sum[idx];
            if (!bucket.count) return center;
            return {
              r: Math.round(bucket.r / bucket.count),
              g: Math.round(bucket.g / bucket.count),
              b: Math.round(bucket.b / bucket.count)
            };
          });
        }

        const clusters = centroids
          .map((center) => ({ ...center, count: 0 }))
          .filter(Boolean);
        for (const sample of samples) {
          let bestIdx = 0;
          let bestDistance = Number.POSITIVE_INFINITY;
          for (let i = 0; i < clusters.length; i += 1) {
            const center = clusters[i];
            const distance = (sample.r - center.r) ** 2 + (sample.g - center.g) ** 2 + (sample.b - center.b) ** 2;
            if (distance < bestDistance) {
              bestDistance = distance;
              bestIdx = i;
            }
          }
          clusters[bestIdx].count += 1;
        }

        const total = Math.max(1, samples.length);
        const ranked = clusters
          .filter((cluster) => cluster.count > 0)
          .map((cluster) => {
            const { s } = rgbToHsv(cluster.r, cluster.g, cluster.b);
            const share = (cluster.count / total) * 100;
            const score = share * (0.65 + s * 0.85);
            return { ...cluster, share, score, saturation: s };
          })
          .sort((a, b) => b.score - a.score);

        const selected: DetectedColor[] = [];
        for (const color of ranked) {
          if (selected.length >= limit) break;
          const duplicateLike = selected.some((existing) => {
            const er = Number.parseInt(existing.hex.slice(1, 3), 16);
            const eg = Number.parseInt(existing.hex.slice(3, 5), 16);
            const eb = Number.parseInt(existing.hex.slice(5, 7), 16);
            const distance = Math.sqrt((color.r - er) ** 2 + (color.g - eg) ** 2 + (color.b - eb) ** 2);
            return distance < 26;
          });
          if (duplicateLike) continue;
          selected.push({
            hex: rgbToHex(color.r, color.g, color.b),
            name: nearestColorName(color.r, color.g, color.b),
            share: Math.round(color.share)
          });
        }

        const hasNeutral = ranked.some((item) => item.saturation < 0.16 && item.share >= 7);
        const selectedHasNeutral = selected.some((item) => {
          const r = Number.parseInt(item.hex.slice(1, 3), 16);
          const g = Number.parseInt(item.hex.slice(3, 5), 16);
          const b = Number.parseInt(item.hex.slice(5, 7), 16);
          return rgbToHsv(r, g, b).s < 0.16;
        });
        if (hasNeutral && !selectedHasNeutral) {
          const neutral = ranked.find((item) => item.saturation < 0.16 && item.share >= 7);
          if (neutral) {
            if (selected.length >= limit) selected.pop();
            selected.push({
              hex: rgbToHex(neutral.r, neutral.g, neutral.b),
              name: nearestColorName(neutral.r, neutral.g, neutral.b),
              share: Math.round(neutral.share)
            });
          }
        }

        resolve(selected.sort((a, b) => b.share - a.share).slice(0, limit));
      } catch {
        resolve([]);
      }
    };
    image.onerror = () => resolve([]);
    image.src = imageUrl;
  });
}

function normalizeStage(value?: string, status?: BaseResult["project_status"]): StageLabel {
  if (status === "completed") return "Completed";
  if (!value) return "Planning";
  const v = value.toLowerCase();
  if (v.includes("plan")) return "Planning";
  if (v.includes("found")) return "Foundation";
  if (v.includes("struct") || v.includes("frame")) return "Structure";
  if (v.includes("service") || v.includes("mep") || v.includes("electric") || v.includes("plumb")) return "Services";
  if (v.includes("finish") || v.includes("interior") || v.includes("paint")) return "Finishing";
  return "Structure";
}

function availabilityPill(level: Availability) {
  if (level === "High") return "bg-emerald-500/15 text-emerald-700";
  if (level === "Medium") return "bg-amber-500/15 text-amber-700";
  return "bg-rose-500/15 text-rose-700";
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">{children}</div>;
}

function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={() => setOpen(false)}
      className="relative ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[color:var(--line)] text-[10px] font-bold text-[color:var(--muted)]"
      aria-label="Info"
    >
      i
      <span
        className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-lg border border-[color:var(--line)] bg-[color:var(--card)] p-2 text-[10px] font-semibold text-[color:var(--text)] shadow-lg transition ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        {text}
      </span>
    </button>
  );
}

function StatCard({ label, value, tooltip, tag }: { label: string; value: React.ReactNode; tooltip?: string; tag?: React.ReactNode }) {
  const valueText = typeof value === "string" ? value : "";
  const compactValueClass = valueText.length > 34 ? "text-[clamp(9px,1vw,13px)]" : "text-[clamp(10px,1.15vw,15px)]";
  return (
    <div className="min-w-0 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-1 break-words text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
        {label}
        {tooltip ? <Info text={tooltip} /> : null}
      </div>
      <div
        className={`mt-2 max-w-full whitespace-normal break-words [overflow-wrap:break-word] [word-break:normal] ${compactValueClass} font-bold leading-tight text-[color:var(--text)]`}
      >
        {value}
      </div>
      {tag ? <div className="mt-2 whitespace-normal break-words [overflow-wrap:break-word] [word-break:normal]">{tag}</div> : null}
    </div>
  );
}

export default function Page() {
  const [usage, setUsage] = useState<{ freeUsed: number; freeRemaining: number | "∞"; paid: boolean; scansLimit: number; scansUsed: number } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register" | "access-code">("login");
  const [regName, setRegName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authPlan, setAuthPlan] = useState<string | null>(null);
  const [authName, setAuthName] = useState<string | null>(null);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    location: "",
    projectType: "Residential",
    scale: "Low-rise",
    constructionType: "RCC",
    note: ""
  });
  const [geoStatus, setGeoStatus] = useState<"exif" | "gps" | "manual" | "denied" | "none">("none");

  const [loading, setLoading] = useState(false);
  const [advLoading, setAdvLoading] = useState(false);
  const [colorLoading, setColorLoading] = useState(false);
  const [detectedColors, setDetectedColors] = useState<DetectedColor[]>([]);

  const [base, setBase] = useState<BaseResult | null>(null);
  const [advanced, setAdvanced] = useState<AdvancedResult | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "hc">("light");
  const [lang, setLang] = useState<Lang>("EN");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [rates, setRates] = useState<RatesPayload | null>(null);
  const [rateStatus, setRateStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [answerTranslations, setAnswerTranslations] = useState<Record<string, string>>({});

  const browseInputRef = useRef<HTMLInputElement>(null);
  const liveInputRef = useRef<HTMLInputElement>(null);

  const apiFetch = useCallback((path: string, options?: RequestInit) => {
    const storedCode = typeof window !== "undefined" ? window.localStorage.getItem("va_access_code") : null;
    const headers = new Headers(options?.headers);
    if (storedCode) headers.set("x-vision-access-code", storedCode);
    return fetch(apiUrl(path), { credentials: "include", ...options, headers });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = window.localStorage.getItem("theme");
    const savedLang = window.localStorage.getItem("lang");
    const savedCurrency = window.localStorage.getItem("currency");
    const savedAccessCode = window.localStorage.getItem("va_access_code");
    if (savedAccessCode) setAuthPlan("pro");
    if (savedTheme === "dark" || savedTheme === "hc" || savedTheme === "light") setTheme(savedTheme);
    if (savedLang && LANGUAGE_OPTIONS.some((option) => option.value === savedLang)) {
      setLang(savedLang as Lang);
    }
    if (
      savedCurrency &&
      [
        "USD",
        "INR",
        "AED",
        "EUR",
        "GBP",
        "SGD",
        "AUD",
        "CAD",
        "NZD",
        "CHF",
        "SEK",
        "NOK",
        "DKK",
        "ZAR",
        "JPY",
        "CNY",
        "HKD",
        "SAR",
        "QAR",
        "KRW",
        "THB",
        "MYR",
        "IDR",
        "PHP",
        "BRL",
        "MXN",
        "PLN",
        "CZK",
        "TRY"
      ].includes(savedCurrency)
    ) {
      setCurrency(savedCurrency as Currency);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("lang", lang);
    window.localStorage.setItem("currency", currency);
  }, [lang, currency]);

  const selectedCategoryRow = useMemo(() => {
    return base?.category_matrix ?? null;
  }, [base]);

  const categoryEntries = selectedCategoryRow
    ? [
        { label: "Category", value: selectedCategoryRow.Category },
        { label: "Typology", value: selectedCategoryRow.Typology },
        { label: "Style", value: selectedCategoryRow.Style },
        { label: "Climate Adaptability", value: selectedCategoryRow.ClimateAdaptability },
        { label: "Terrain", value: selectedCategoryRow.Terrain },
        { label: "Soil Type", value: selectedCategoryRow.SoilType },
        { label: "Material Used", value: selectedCategoryRow.MaterialUsed },
        { label: "Interior Layout", value: selectedCategoryRow.InteriorLayout },
        { label: "Roof Type", value: selectedCategoryRow.RoofType },
        { label: "Exterior", value: selectedCategoryRow.Exterior },
        { label: "Additional Features", value: selectedCategoryRow.AdditionalFeatures },
        { label: "Sustainability", value: selectedCategoryRow.Sustainability }
      ]
    : [];

  useEffect(() => {
    let active = true;
    const loadRates = async () => {
      setRateStatus("loading");
      try {
        const r = await apiFetch("/api/rates?base=USD", { cache: "no-store" });
        const j = (await r.json()) as RatesPayload;
        if (!r.ok || !j?.rates) throw new Error("rates");
        if (!active) return;
        setRates(j);
        setRateStatus("ok");
      } catch {
        if (!active) return;
        setRateStatus("error");
      }
    };
    loadRates();
    return () => {
      active = false;
    };
  }, []);

  const t = useCallback(
    (key: string) => {
      return LANGUAGE_LABELS[lang][key] ?? LANGUAGE_LABELS.EN[key] ?? key;
    },
    [lang]
  );

  const languageName = useMemo(() => {
    return LANGUAGE_OPTIONS.find((item) => item.value === lang)?.label ?? "English";
  }, [lang]);

  async function readJson<T>(r: Response): Promise<{ data: T | null; text: string }> {
    const text = await r.text();
    if (!text) return { data: null, text: "" };
    try {
      return { data: JSON.parse(text) as T, text };
    } catch {
      return { data: null, text };
    }
  }

  const refreshUsage = useCallback(async () => {
    const r = await apiFetch("/api/usage", { cache: "no-store" });
    const { data } = await readJson<{ freeUsed: number; freeRemaining: number | null; paid: boolean; email: string | null; plan: string | null; name: string | null; scansLimit: number; scansUsed: number }>(r);
    if (!data) return;
    setUsage({
      freeUsed: data.freeUsed,
      freeRemaining: data.freeRemaining === null ? "∞" : data.freeRemaining,
      paid: data.paid,
      scansLimit: data.scansLimit ?? 3,
      scansUsed: data.scansUsed ?? 0
    });
    if (data.email) {
      setAuthEmail(data.email);
      setAuthPlan(data.plan ?? "free");
      setAuthName(data.name ?? null);
    }
  }, []);

  useEffect(() => {
    refreshUsage().catch(() => {});
  }, [refreshUsage]);

  const freeRemaining = usage ? (usage.freeRemaining === "∞" ? Infinity : usage.freeRemaining) : 0;
  const paywalled = usage ? !usage.paid && freeRemaining <= 0 : false;
  const canRun = useMemo(() => {
    if (!usage) return false;
    if (usage.paid) return true;
    return (usage.freeRemaining as number) > 0;
  }, [usage]);

  async function requestGps() {
    if (!navigator.geolocation) {
      setGeoStatus("none");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        setMeta((s) => ({ ...s, location: `${lat},${lon}` }));
        setGeoStatus("gps");
      },
      () => {
        setGeoStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }

  async function tryExif(file: File) {
    try {
      const exifr = await import("exifr");
      const gps = await exifr.gps(file);
      if (gps?.latitude && gps?.longitude) {
        const lat = gps.latitude.toFixed(5);
        const lon = gps.longitude.toFixed(5);
        setMeta((s) => ({ ...s, location: `${lat},${lon}` }));
        setGeoStatus("exif");
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  async function onPickFile(file: File) {
    setError(null);
    setBase(null);
    setAdvanced(null);

    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);

    const exifFound = await tryExif(file);
    if (!exifFound) await requestGps();
  }

  useEffect(() => {
    let active = true;
    if (!imageDataUrl) {
      setDetectedColors([]);
      setColorLoading(false);
      return () => {
        active = false;
      };
    }

    setColorLoading(true);
    extractDominantColors(imageDataUrl, 5)
      .then((colors) => {
        if (!active) return;
        setDetectedColors(colors);
      })
      .catch(() => {
        if (!active) return;
        setDetectedColors([]);
      })
      .finally(() => {
        if (!active) return;
        setColorLoading(false);
      });

    return () => {
      active = false;
    };
  }, [imageDataUrl]);

  async function runBase() {
    if (!imageDataUrl) return;
    setLoading(true);
    setError(null);
    setAdvanced(null);

    try {
      const r = await apiFetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl, meta: { ...meta, language: languageName, currency } })
      });

      const { data: j, text } = await readJson<any>(r);
      if (!r.ok) {
        if (j?.error === "PAYWALL") throw new Error("Paywall");
        const detail = (j?.message ?? j?.error ?? text) || `Request failed (${r.status})`;
        throw new Error(detail);
      }

      if (!j) throw new Error("Failed");
      setBase(j.base);
      setUsage(j.usage);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function runAdvanced() {
    if (!imageDataUrl || !base) return;
    setAdvLoading(true);
    setError(null);

    try {
      const r = await apiFetch("/api/advanced", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl, base, language: languageName })
      });

      const { data: j, text } = await readJson<any>(r);
      if (!r.ok) {
        if (j?.error === "PAYWALL") throw new Error("Paywall");
        const detail = (j?.message ?? j?.error ?? text) || `Request failed (${r.status})`;
        throw new Error(detail);
      }

      if (!j) throw new Error("Failed");
      setAdvanced(j.advanced);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setAdvLoading(false);
    }
  }

  async function signIn() {
    setError(null);
    if (authMode === "access-code") {
      if (!accessCode.trim()) { setError("Access code is required"); return; }
      const r = await apiFetch("/api/auth/access-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: accessCode.trim() })
      });
      const { data: j, text } = await readJson<any>(r);
      if (!r.ok) { setError((j?.error ?? text) || "Invalid access code"); return; }
      window.localStorage.setItem("va_access_code", accessCode.trim());
      setAuthPlan(j?.plan ?? "pro");
      setAccessCode("");
      setAuthMode("login");
      await refreshUsage();
      return;
    }
    if (authMode === "register") {
      if (!regName.trim()) { setError("Name is required"); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
      const r = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name: regName.trim() })
      });
      const { data: j, text } = await readJson<any>(r);
      if (!r.ok) { setError((j?.error ?? text) || "Registration failed"); return; }
      setAuthEmail(email.toLowerCase());
      setAuthPlan(j?.plan ?? "free");
      setAuthName(j?.name ?? regName.trim());
      setEmail(""); setPassword(""); setRegName(""); setAuthMode("login");
      await refreshUsage();
      return;
    }
    const r = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const { data: j, text } = await readJson<any>(r);
    if (!r.ok) {
      setError((j?.error ?? text) || "Failed");
      return;
    }
    setAuthEmail(email.toLowerCase());
    setAuthPlan(j?.plan ?? "free");
    setAuthName(j?.name ?? null);
    setEmail(""); setPassword("");
    await refreshUsage();
  }

  async function signOut() {
    setError(null);
    await apiFetch("/api/auth/logout", { method: "POST" });
    setAuthEmail(null);
    setAuthPlan(null);
    setAuthName(null);
    window.localStorage.removeItem("va_access_code");
    await refreshUsage();
  }

  async function upgrade() {
    setError(null);
    const r = await apiFetch("/api/stripe/checkout", { method: "POST" });
    const { data: j, text } = await readJson<any>(r);
    if (!r.ok) {
      setError((j?.error ?? text) || "Failed");
      return;
    }
    if (j?.url) window.location.href = j.url;
  }

  const status = base?.project_status === "completed" ? "Completed" : base?.project_status === "under_construction" ? "Under Construction" : "Unknown";
  const stageLabel = normalizeStage(base?.stage_of_construction, base?.project_status);

  const rawProgress = Math.min(100, Math.max(0, base?.progress_percent ?? 0));
  const stageRange = STAGE_RANGES.find((range) => range.label === stageLabel);
  const progressValue = stageRange ? Math.min(stageRange.max, Math.max(stageRange.min, rawProgress)) : rawProgress;
  const baseValid = !!base && (status === "Completed" ? progressValue === 100 : stageRange ? progressValue >= stageRange.min && progressValue <= stageRange.max : false);

  const geoFactors = base?.geo_market_factors;
  const resourcePlan = useMemo(() => {
    if (!baseValid || !base) return null;
    return buildResourcePlan({
      status,
      stage: stageLabel,
      progressValue,
      projectType: meta.projectType,
      scale: meta.scale,
      constructionType: meta.constructionType,
      location: meta.location,
      note: meta.note,
      category: selectedCategoryRow,
      geo: geoFactors,
      advancedRecommendations: advanced?.recommendations ?? []
    });
  }, [advanced?.recommendations, base, baseValid, geoFactors, meta.constructionType, meta.location, meta.note, meta.projectType, meta.scale, progressValue, selectedCategoryRow, stageLabel, status]);

  const errorShort = error ? compactWords(error, 2) : null;

  const constructionInsights =
    !baseValid ? [t("awaitingBase")] : paywalled ? [t("revealRisks")] : (resourcePlan?.constructionInsights ?? [t("pending")]).map((item) => cleanSentence(item));
  const procurementInsights =
    !baseValid ? [t("awaitingBase")] : paywalled ? [t("revealRisks")] : (resourcePlan?.procurementInsights ?? [t("pending")]).map((item) => cleanSentence(item));
  const completionInsights =
    !baseValid ? [t("awaitingBase")] : paywalled ? [t("revealRisks")] : (resourcePlan?.completionInsights ?? [t("pending")]).map((item) => cleanSentence(item));

  const constructionInsightSignature = constructionInsights.slice(0, 4).join("\u001f");
  const procurementInsightSignature = procurementInsights.slice(0, 4).join("\u001f");
  const completionInsightSignature = completionInsights.slice(0, 4).join("\u001f");
  const notesSignature = (base?.notes ?? []).slice(0, 4).join("\u001f");
  const answerSourceTexts = useMemo(() => {
    const source = [
      "Construction Priorities",
      "Procurement Priorities",
      "Completion Requirements",
      ...constructionInsights.slice(0, 4),
      ...procurementInsights.slice(0, 4),
      ...completionInsights.slice(0, 4),
      ...(base?.notes ?? []).slice(0, 4)
    ];
    const unique = new Set<string>();
    source.forEach((value) => {
      const cleaned = value.replace(/\s+/g, " ").trim();
      if (cleaned) unique.add(cleaned);
    });
    return Array.from(unique);
  }, [constructionInsightSignature, procurementInsightSignature, completionInsightSignature, notesSignature]);

  useEffect(() => {
    let active = true;

    if (lang === "EN" || !answerSourceTexts.length) {
      setAnswerTranslations({});
      return () => {
        active = false;
      };
    }

    const translateAnswers = async () => {
      try {
        const r = await apiFetch("/api/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ language: languageName, texts: answerSourceTexts })
        });
        const text = await r.text();
        let parsed: { items?: string[] } | null = null;
        try {
          parsed = text ? (JSON.parse(text) as { items?: string[] }) : null;
        } catch {
          parsed = null;
        }

        if (!active) return;
        const translatedItems = Array.isArray(parsed?.items) ? parsed.items : [];
        if (!r.ok || translatedItems.length !== answerSourceTexts.length) {
          setAnswerTranslations({});
          return;
        }

        const next: Record<string, string> = {};
        answerSourceTexts.forEach((source, idx) => {
          const translated = typeof translatedItems[idx] === "string" ? translatedItems[idx].trim() : "";
          if (translated) next[source] = translated;
        });
        setAnswerTranslations(next);
      } catch {
        if (!active) return;
        setAnswerTranslations({});
      }
    };

    translateAnswers();
    return () => {
      active = false;
    };
  }, [lang, languageName, answerSourceTexts, apiFetch]);

  const trAnswer = useCallback(
    (value: string) => {
      if (lang === "EN") return value;
      return answerTranslations[value] ?? value;
    },
    [lang, answerTranslations]
  );

  const pendingValue = <span className="text-[color:var(--muted)]">{t("pending")}</span>;
  const premium = (value: React.ReactNode) => (paywalled ? <span className="text-[color:var(--muted)]">Locked</span> : value);

  const fxRate = rates?.rates?.[currency];
  const fxInfo =
    rateStatus === "ok" && fxRate
      ? `FX: 1 ${rates?.base ?? "USD"} = ${fxRate.toFixed(3)} ${currency}`
      : rateStatus === "error"
        ? "FX unavailable"
        : "FX loading";
  const uncertainty = useMemo(() => {
    let spread = 0.14;
    if (!meta.location.trim()) spread += 0.08;
    if (!meta.note.trim()) spread += 0.03;
    if (geoStatus === "none" || geoStatus === "denied") spread += 0.07;
    else if (geoStatus === "manual") spread += 0.03;
    if (!advanced) spread += 0.03;
    return clampNumber(spread, 0.12, 0.36);
  }, [advanced, geoStatus, meta.location, meta.note]);

  const accuracyTargetRange = useMemo(() => {
    let targetCenter = 58;
    if (imageDataUrl) targetCenter += 10;
    if (baseValid) targetCenter += 8;
    if (advanced) targetCenter += 6;
    if (meta.location.trim()) targetCenter += 6;
    if (meta.note.trim()) targetCenter += 4;
    if (geoStatus === "gps" || geoStatus === "exif") targetCenter += 5;
    else if (geoStatus === "manual") targetCenter += 2;
    if (selectedCategoryRow?.Typology) targetCenter += 3;
    const rawRange = toRange(targetCenter, uncertainty * 0.55, 40);
    const clamped = clampRange(rawRange, 40, 98);
    return {
      min: Math.min(clamped.min, clamped.max - 1),
      max: Math.max(clamped.max, clamped.min + 1)
    };
  }, [advanced, baseValid, geoStatus, imageDataUrl, meta.location, meta.note, selectedCategoryRow?.Typology, uncertainty]);
  const accuracyDisplay = `${formatNumberRange(accuracyTargetRange, 0)}%`;
  const accuracyMidpoint = clampNumber((accuracyTargetRange.min + accuracyTargetRange.max) / 2, 0, 100);

  const laborCostUsd = resourcePlan?.labor.reduce((sum, item) => sum + item.totalCostUsd, 0) ?? 0;
  const machineryCostUsd = resourcePlan?.machinery.reduce((sum, item) => sum + item.totalCostUsd, 0) ?? 0;
  const materialCostUsd = resourcePlan?.materials.reduce((sum, item) => sum + item.totalCostUsd, 0) ?? 0;
  const totalCostUsd = laborCostUsd + machineryCostUsd + materialCostUsd;
  const totalCostRange = toRange(totalCostUsd, uncertainty, 0);
  const hoursRemainingRange = toRange(base?.timeline.hours_remaining ?? 0, uncertainty * 0.9, 0);
  const manpowerHoursRange = toRange(base?.timeline.manpower_hours ?? 0, uncertainty * 0.9, 0);
  const machineryHoursRange = toRange(base?.timeline.machinery_hours ?? 0, uncertainty * 0.9, 0);
  const locationCostIndexRange = toRange(resourcePlan?.locationCostIndex ?? 1, uncertainty * 0.3, 0.1);
  const paintRows = useMemo(() => {
    if (!resourcePlan) return [];
    if (!detectedColors.length) return resourcePlan.paints;
    return resourcePlan.paints.map((paint, idx) => {
      const color = detectedColors[idx % detectedColors.length];
      return {
        ...paint,
        shade: `${color.name} Tone`,
        colorCode: color.hex
      };
    });
  }, [resourcePlan, detectedColors]);

  return (
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 right-10 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,var(--glow-1),transparent_70%)]" />
        <div className="absolute bottom-[-120px] left-[-80px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,var(--glow-2),transparent_70%)]" />
      </div>

      <header className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-4 px-4 pt-8 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
          {errorShort ? <Badge>{errorShort}</Badge> : null}
          {usage ? <Badge>{usage.paid ? "Pro" : `${Math.max(0, (usage.scansLimit ?? 3) - (usage.scansUsed ?? 0))}/${usage.scansLimit ?? 3}`}</Badge> : null}
        </div>
        <div className="text-center">
          <div className="text-2xl font-black tracking-tight text-[color:var(--text)]">Vision</div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">Resource Planning</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">{t("engine")}</div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
          <div className="flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">{t("language")}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="bg-transparent text-xs font-semibold text-[color:var(--text)] outline-none"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">{t("currency")}</span>
            <Info text={fxInfo} />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="bg-transparent text-xs font-semibold text-[color:var(--text)] outline-none"
            >
              {Object.values(CURRENCY_LABELS).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant={theme === "light" ? "primary" : "outline"} onClick={() => setTheme("light")} className="h-9 px-2 text-xs">
              {t("light")}
            </Button>
            <Button variant={theme === "dark" ? "primary" : "outline"} onClick={() => setTheme("dark")} className="h-9 px-2 text-xs">
              {t("dark")}
            </Button>
            <Button variant={theme === "hc" ? "primary" : "outline"} onClick={() => setTheme("hc")} className="h-9 px-2 text-xs">
              {t("highContrast")}
            </Button>
          </div>
          {authEmail ? (
            <>
              <Badge>{authName ?? authEmail.split("@")[0]}</Badge>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  background: authPlan === "pro" ? "rgba(124,58,237,0.2)" : "rgba(100,116,139,0.15)",
                  color: authPlan === "pro" ? "#a78bfa" : "#94a3b8",
                  border: authPlan === "pro" ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(100,116,139,0.2)"
                }}
              >
                {authPlan === "pro" ? "Pro" : "Free"}
              </span>
              <Button variant="outline" onClick={signOut} className="h-9 px-3 text-xs">
                Sign Out
              </Button>
            </>
          ) : authMode === "access-code" ? (
            <>
              <input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Enter access code"
                onKeyDown={(e) => { if (e.key === "Enter" && accessCode.trim()) signIn(); }}
                className="h-9 w-[180px] rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] px-3 text-xs font-semibold text-[color:var(--text)] outline-none focus:border-[color:var(--text)]"
              />
              <Button onClick={signIn} disabled={!accessCode.trim()} className="h-9 px-3 text-xs">
                Submit
              </Button>
              <button
                onClick={() => setAuthMode("login")}
                className="text-[10px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--text)] underline"
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              {authMode === "register" && (
                <input
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Name"
                  className="h-9 w-[120px] rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] px-3 text-xs font-semibold text-[color:var(--text)] outline-none focus:border-[color:var(--text)]"
                />
              )}
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="h-9 w-[160px] rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] px-3 text-xs font-semibold text-[color:var(--text)] outline-none focus:border-[color:var(--text)]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                onKeyDown={(e) => { if (e.key === "Enter" && email.includes("@") && password) signIn(); }}
                className="h-9 w-[120px] rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] px-3 text-xs font-semibold text-[color:var(--text)] outline-none focus:border-[color:var(--text)]"
              />
              <Button onClick={signIn} disabled={!email.includes("@") || !password} className="h-9 px-3 text-xs">
                {authMode === "register" ? "Register" : "Sign In"}
              </Button>
              <button
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className="text-[10px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--text)] underline"
              >
                {authMode === "login" ? "Register" : "Sign In"}
              </button>
              <button
                onClick={() => setAuthMode("access-code")}
                className="text-[10px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--text)] underline"
              >
                Access Code
              </button>
            </>
          )}
          {authPlan !== "pro" && (
          <Button variant="primary" onClick={upgrade} className="h-9 px-3 text-xs">
            Upgrade
          </Button>
          )}
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-[1400px] px-4 pb-12">
        {error ? (
          <div className="mb-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Error</div>
            <div className="mt-2 break-words text-xs font-semibold text-[color:var(--text)]">{error}</div>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px_1fr]">
          <Card className="order-2 p-4 sm:p-5 lg:order-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>{t("constructionProgress")}</Label>
                <Info text="Stage and progress are inferred from the latest image and metadata." />
              </div>
              <Badge>{status}</Badge>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2">
                <Label>Site Context</Label>
                <Info text="Context focuses on construction execution inputs, not valuation metrics." />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <StatCard
                  label="Terrain / Soil"
                  value={baseValid ? premium(`${geoFactors?.terrain ?? "-"} / ${geoFactors?.soil_condition ?? "-"}`) : pendingValue}
                  tooltip="Base execution risk from terrain and soil profile."
                />
                <StatCard
                  label="Climate / Density"
                  value={baseValid ? premium(`${geoFactors?.climate_zone ?? "-"} / ${geoFactors?.population_density ?? "-"}`) : pendingValue}
                  tooltip="Climate and density influence labor and procurement reliability."
                />
                <StatCard
                  label="Labor Availability"
                  value={baseValid ? premium(resourcePlan?.laborAvailability ?? "Medium") : pendingValue}
                  tooltip="Location-based labor availability for core site trades."
                />
                <StatCard
                  label="Procurement Load"
                  value={baseValid ? premium(`${formatNumberRange(toRange(resourcePlan?.materials.length ?? 0, 0.2, 1), 0)} material lines`) : pendingValue}
                  tooltip="Tracked critical line items required to complete the project."
                />
                <StatCard
                  label="Typology"
                  value={baseValid ? premium(selectedCategoryRow?.Typology ?? "-") : pendingValue}
                  tooltip="Category matrix typology inferred from image context."
                />
                <StatCard
                  label={t("stage")}
                  value={baseValid ? premium(stageLabel) : pendingValue}
                  tooltip="Current construction stage aligned to progress band."
                />
                <StatCard
                  label="Completion Signal"
                  value={baseValid ? premium(advanced?.progress_vs_ideal ?? "On Track") : pendingValue}
                  tooltip="Advanced execution signal from the procurement risk pass."
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2">
                <Label>Color Recognition</Label>
                <Info text="Dominant colors are extracted directly from uploaded image pixels." />
              </div>
              <div className="mt-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3">
                {colorLoading ? (
                  <div className="text-xs font-semibold text-[color:var(--muted)]">Detecting colors...</div>
                ) : detectedColors.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {detectedColors.map((color) => {
                      const shareRange = clampRange(toRange(color.share, 0.2, 0), 0, 100);
                      return (
                        <div key={color.hex} className="flex items-center justify-between rounded-xl border border-[color:var(--line)] px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded-full border border-[color:var(--line)]" style={{ backgroundColor: color.hex }} />
                            <div className="text-[11px] font-semibold text-[color:var(--text)]">
                              {color.name} ({color.hex})
                            </div>
                          </div>
                          <div className="text-[10px] font-semibold text-[color:var(--muted)]">{formatNumberRange(shareRange, 0)}%</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-[color:var(--muted)]">Upload image to detect colors.</div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2">
                <Label>{t("insights")}</Label>
                <Info text="Insights are focused on construction, procurement, and completion requirements unique to this property." />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">{trAnswer("Construction Priorities")}</div>
                  <ul className="mt-2 list-none space-y-2 pl-0">
                    {constructionInsights.slice(0, 4).map((item, i) => (
                      <li key={`construction-insight-${i}`} className="whitespace-normal break-normal [overflow-wrap:break-word] text-[11px] font-semibold leading-snug text-[color:var(--text)]">
                        {trAnswer(item)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">{trAnswer("Procurement Priorities")}</div>
                  <ul className="mt-2 list-none space-y-2 pl-0">
                    {procurementInsights.slice(0, 4).map((item, i) => (
                      <li key={`procurement-insight-${i}`} className="whitespace-normal break-normal [overflow-wrap:break-word] text-[11px] font-semibold leading-snug text-[color:var(--text)]">
                        {trAnswer(item)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">{trAnswer("Completion Requirements")}</div>
                  <ul className="mt-2 list-none space-y-2 pl-0">
                    {completionInsights.slice(0, 4).map((item, i) => (
                      <li key={`completion-insight-${i}`} className="whitespace-normal break-normal [overflow-wrap:break-word] text-[11px] font-semibold leading-snug text-[color:var(--text)]">
                        {trAnswer(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2">
                <Label>Execution Components</Label>
                <Info text="Special components, techniques, vernacular materials, and pick/replicate/avoid guidance in one place." />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Special Components</div>
                  {baseValid && resourcePlan ? (
                    <ul className="mt-2 list-none space-y-2 pl-0">
                      {resourcePlan.components.map((item) => (
                        <li key={`left-component-${item}`} className="text-[11px] font-semibold leading-snug text-[color:var(--text)]">
                          {trAnswer(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">{t("pending")}</div>
                  )}
                </div>
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Construction Techniques</div>
                  {baseValid && resourcePlan ? (
                    <ul className="mt-2 list-none space-y-2 pl-0">
                      {resourcePlan.techniques.map((item) => (
                        <li key={`left-technique-${item}`} className="text-[11px] font-semibold leading-snug text-[color:var(--text)]">
                          {trAnswer(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">{t("pending")}</div>
                  )}
                </div>
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Vernacular Materials</div>
                  {baseValid && resourcePlan ? (
                    <ul className="mt-2 list-none space-y-2 pl-0">
                      {resourcePlan.vernacularMaterials.map((item) => (
                        <li key={`left-vernacular-${item}`} className="text-[11px] font-semibold leading-snug text-[color:var(--text)]">
                          {trAnswer(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">{t("pending")}</div>
                  )}
                </div>
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Pick / Replicate / Avoid</div>
                  {baseValid && resourcePlan ? (
                    <ul className="mt-2 list-none space-y-2 pl-0">
                      {resourcePlan.specialRequirements.map((item) => (
                        <li key={`left-special-${item}`} className="text-[11px] font-semibold leading-snug text-[color:var(--text)]">
                          {trAnswer(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-xs font-semibold text-[color:var(--muted)]">{t("pending")}</div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="order-1 mx-auto flex w-full max-w-[400px] flex-col gap-4 lg:order-none lg:w-[400px] lg:max-w-none">
            <Card className="flex flex-col items-center gap-2 p-4 sm:p-5 lg:h-[400px]">
              <div className="text-center">
                <Label>{t("capture")}</Label>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">{t("inputWindow")}</div>
              </div>

              <div className="relative h-[190px] w-[190px] overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] sm:h-[210px] sm:w-[210px] lg:h-[210px] lg:w-[210px]">
                {imageDataUrl ? (
                  <img src={imageDataUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[color:var(--muted)]">Empty</div>
                )}
                <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,rgba(0,0,0,0.25)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.25)_1px,transparent_1px)] [background-size:33%_100%,100%_33%]" />
                <div className="pointer-events-none absolute inset-2 rounded-xl border border-[color:var(--line)]" />
              </div>

              <div className="w-full max-w-[300px] space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (browseInputRef.current) {
                        browseInputRef.current.value = "";
                        browseInputRef.current.click();
                      }
                    }}
                    className="rounded-lg border border-[color:var(--line)] bg-[color:var(--card)] px-2 py-1.5 text-center text-[11px] font-semibold text-[color:var(--text)] hover:bg-[color:var(--pill)]"
                  >
                    {t("browse")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (liveInputRef.current) {
                        liveInputRef.current.value = "";
                        liveInputRef.current.click();
                      }
                    }}
                    className="rounded-lg border border-[color:var(--line)] bg-[color:var(--card)] px-2 py-1.5 text-center text-[11px] font-semibold text-[color:var(--text)] hover:bg-[color:var(--pill)]"
                  >
                    {t("live")}
                  </button>
                </div>
                <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    value={meta.location}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMeta((s) => ({ ...s, location: value }));
                      setGeoStatus(value ? "manual" : "none");
                    }}
                    placeholder={t("location")}
                    list="city-list"
                    autoComplete="address-level2"
                    className="h-7 rounded-lg border border-[color:var(--line)] bg-[color:var(--card)] px-2 text-[10px] font-semibold text-[color:var(--text)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={requestGps}
                    className="rounded-lg border border-[color:var(--line)] bg-[color:var(--card)] px-2 py-1 text-[10px] font-semibold text-[color:var(--text)]"
                  >
                    {t("useGps")}
                  </button>
                  <Badge>
                    {geoStatus === "exif"
                      ? t("exif")
                      : geoStatus === "gps"
                        ? t("gps")
                        : geoStatus === "manual"
                          ? t("manual")
                          : geoStatus === "denied"
                            ? t("gpsOff")
                            : t("noGps")}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={meta.projectType}
                    onChange={(e) => setMeta((s) => ({ ...s, projectType: e.target.value }))}
                    className="h-7 rounded-lg border border-[color:var(--line)] bg-[color:var(--card)] px-2 text-[9px] font-semibold text-[color:var(--text)] outline-none"
                  >
                    <option>Residential</option>
                    <option>Commercial</option>
                    <option>Industrial</option>
                    <option>Mixed-use</option>
                    <option>Infrastructure</option>
                  </select>
                  <select
                    value={meta.scale}
                    onChange={(e) => setMeta((s) => ({ ...s, scale: e.target.value }))}
                    className="h-7 rounded-lg border border-[color:var(--line)] bg-[color:var(--card)] px-2 text-[9px] font-semibold text-[color:var(--text)] outline-none"
                  >
                    <option>Low-rise</option>
                    <option>Mid-rise</option>
                    <option>High-rise</option>
                    <option>Large-site</option>
                  </select>
                  <select
                    value={meta.constructionType}
                    onChange={(e) => setMeta((s) => ({ ...s, constructionType: e.target.value }))}
                    className="h-7 rounded-lg border border-[color:var(--line)] bg-[color:var(--card)] px-2 text-[9px] font-semibold text-[color:var(--text)] outline-none"
                  >
                    <option>RCC</option>
                    <option>Steel</option>
                    <option>Hybrid</option>
                  </select>
                </div>
                <input
                  value={meta.note}
                  onChange={(e) => setMeta((s) => ({ ...s, note: e.target.value }))}
                  placeholder={t("notes")}
                  className="h-7 rounded-lg border border-[color:var(--line)] bg-[color:var(--card)] px-2 text-[10px] font-semibold text-[color:var(--text)] outline-none"
                />
                <button
                  type="button"
                  onClick={runBase}
                  disabled={!imageDataUrl || loading || !canRun}
                  className="w-full rounded-lg bg-[color:var(--accent)] px-2 py-2 text-center text-[11px] font-semibold text-[color:var(--accent-contrast)] disabled:opacity-40"
                >
                  {loading ? "..." : t("analyze")}
                </button>
                <datalist id="city-list">
                  {CITY_SUGGESTIONS.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
                <input
                  ref={browseInputRef}
                  type="file"
                  accept="image/*"
                  multiple={false}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
                />
                <input
                  ref={liveInputRef}
                  type="file"
                  accept="image/*"
                  multiple={false}
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
                />
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Category Matrix</Label>
                  <Info text="AI selects the closest row from the reference dataset based on the image context." />
                </div>
                <Badge>AI</Badge>
              </div>
              <div className="mt-3">
                {baseValid && selectedCategoryRow ? (
                  <table className="w-full border-collapse text-[10px] text-[color:var(--text)]">
                    <tbody>
                      {categoryEntries.map((entry) => (
                        <tr key={entry.label} className="border-t border-[color:var(--line)]">
                          <td className="w-[40%] px-2 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                            {entry.label}
                          </td>
                          <td className="px-2 py-2 break-words text-[10px] font-semibold text-[color:var(--text)]">{entry.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-2 py-2 text-[color:var(--muted)]">{baseValid ? "No category matrix returned" : t("pending")}</div>
                )}
              </div>
            </Card>

            {/* Usage Panel */}
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Account</Label>
                </div>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: authPlan === "pro" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                    color: authPlan === "pro" ? "#10b981" : "#f59e0b",
                    border: authPlan === "pro" ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(245,158,11,0.2)"
                  }}
                >
                  {authPlan === "pro"
                    ? (typeof window !== "undefined" && window.localStorage.getItem("va_access_code") ? "Pro (Access Code)" : "Pro Plan")
                    : "Free Plan"}
                </span>
              </div>
              {authEmail && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent)] text-xs font-bold text-[color:var(--accent-contrast)]">
                    {(authName ?? authEmail)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[color:var(--text)]">{authName ?? authEmail.split("@")[0]}</div>
                    <div className="text-[10px] text-[color:var(--muted)]">{authEmail}</div>
                  </div>
                </div>
              )}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--text)]">
                  <span>{usage?.paid ? "Unlimited scans" : `${usage ? Math.max(0, (usage.scansLimit ?? 3) - (usage.scansUsed ?? 0)) : 3} scan${usage && Math.max(0, (usage.scansLimit ?? 3) - (usage.scansUsed ?? 0)) === 1 ? "" : "s"} remaining`}</span>
                  {!usage?.paid && <span className="text-[10px] text-[color:var(--muted)]">{usage?.scansUsed ?? 0}/{usage?.scansLimit ?? 3}</span>}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color:var(--pill)]">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: usage?.paid ? "100%" : `${Math.min(100, Math.round(((usage?.scansUsed ?? 0) / (usage?.scansLimit ?? 3)) * 100))}%`,
                      backgroundColor: usage?.paid ? "#10b981" : "#f59e0b"
                    }}
                  />
                </div>
                <div className="mt-1.5 text-[10px] text-[color:var(--muted)]">
                  {usage?.paid
                    ? "Unlimited access unlocked."
                    : paywalled
                      ? "Scan limit reached. Upgrade to Pro."
                      : freeRemaining === 1
                        ? "1 scan remaining! Upgrade now."
                        : "Upgrade for unlimited scans."}
                </div>
              </div>
              {!authEmail && !usage?.paid && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() => setAuthMode("login")}
                    className="text-[10px] font-semibold text-[color:var(--accent)] underline"
                  >
                    Sign in for more scans
                  </button>
                </div>
              )}
            </Card>
          </div>

          <Card className="order-3 p-4 sm:p-5 lg:order-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Resource Planning</Label>
                <Info text="Labor, machinery, paint, components, material quantities, and location-adjusted costs needed to complete this project." />
              </div>
              {paywalled ? <Badge>Locked</Badge> : <Badge>Active</Badge>}
            </div>

            <div className="mt-4">
              <div className="flex items-end justify-between">
                <div className="text-[clamp(24px,3.6vw,52px)] font-black leading-none text-[color:var(--text)]">
                  {baseValid ? premium(accuracyDisplay) : "—"}
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Target Accuracy
                  <Info text="Recommended accuracy range based on input completeness, geolocation precision, and model confidence constraints." />
                </div>
              </div>
              <div className="mt-3">
                <div className="relative h-2 overflow-hidden rounded-full bg-[color:var(--card-weak)]">
                  <div className="h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${baseValid ? accuracyMidpoint : 0}%` }} />
                  {[0, 25, 50, 75, 100].map((pos) => (
                    <span key={pos} className="absolute top-0 h-2 w-[2px] bg-[color:var(--line)]" style={{ left: `${pos}%` }} />
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-5 text-[8px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)] sm:text-[9px]">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <StatCard
                label="Hours Remaining"
                value={baseValid ? premium(formatUnitRange(hoursRemainingRange, "h", 0)) : pendingValue}
                tooltip="Estimated remaining hours to completion."
              />
              <StatCard
                label="Manpower Hours"
                value={baseValid ? premium(formatUnitRange(manpowerHoursRange, "h", 0)) : pendingValue}
                tooltip="Estimated manpower hours in remaining scope."
              />
              <StatCard
                label="Machinery Hours"
                value={baseValid ? premium(formatUnitRange(machineryHoursRange, "h", 0)) : pendingValue}
                tooltip="Estimated machine hours in remaining scope."
              />
              <StatCard
                label="Estimated Total Cost"
                value={baseValid ? premium(formatCurrencyRange(currency, totalCostRange, rates)) : pendingValue}
                tooltip="Location-adjusted labor + machinery + material estimate."
                tag={<Badge>{CURRENCY_LABELS[currency].name}</Badge>}
              />
              <StatCard
                label="Labor Availability"
                value={baseValid ? premium(resourcePlan?.laborAvailability ?? "Medium") : pendingValue}
                tooltip="Location-based labor supply for the required trades."
              />
              <StatCard
                label="Location Cost Index"
                value={baseValid ? premium(`${formatNumberRange(locationCostIndexRange, 2)}x`) : pendingValue}
                tooltip="Relative cost multiplier inferred from location."
              />
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2">
                <Label>Human Resources Required</Label>
                <Info text="Role-wise headcount, labor availability, and estimated cost." />
              </div>
              {baseValid && resourcePlan ? (
                <div className="mt-2 overflow-x-auto rounded-2xl border border-[color:var(--line)]">
                  <table className="w-full border-collapse text-[10px] text-[color:var(--text)]">
                    <thead className="bg-[color:var(--card-weak)]">
                      <tr>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Role</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Req</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Availability</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resourcePlan.labor.map((item) => (
                        (() => {
                          const requiredRange = toRange(item.required, uncertainty * 0.7, 1);
                          const costRange = toRange(item.totalCostUsd, uncertainty, 0);
                          return (
                            <tr key={item.role} className="border-t border-[color:var(--line)]">
                              <td className="px-2 py-2 font-semibold">{item.role}</td>
                              <td className="px-2 py-2">{formatNumberRange(requiredRange, 0)}</td>
                              <td className="px-2 py-2">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${availabilityPill(item.availability)}`}>
                                  {item.availability}
                                </span>
                              </td>
                              <td className="px-2 py-2 font-semibold">{premium(formatCurrencyRange(currency, costRange, rates))}</td>
                            </tr>
                          );
                        })()
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-[color:var(--line)] px-3 py-3 text-xs text-[color:var(--muted)]">{t("pending")}</div>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2">
                <Label>Machinery Required</Label>
                <Info text="Machine plan for remaining construction stages." />
              </div>
              {baseValid && resourcePlan ? (
                <div className="mt-2 overflow-x-auto rounded-2xl border border-[color:var(--line)]">
                  <table className="w-full border-collapse text-[10px] text-[color:var(--text)]">
                    <thead className="bg-[color:var(--card-weak)]">
                      <tr>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Machine</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Units</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Hours</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resourcePlan.machinery.map((item) => (
                        (() => {
                          const unitsRange = toRange(item.units, uncertainty * 0.6, 1);
                          const hoursRange = toRange(item.estimatedHours, uncertainty * 0.85, 1);
                          const costRange = toRange(item.totalCostUsd, uncertainty, 0);
                          return (
                            <tr key={item.machine} className="border-t border-[color:var(--line)]">
                              <td className="px-2 py-2 font-semibold">{item.machine}</td>
                              <td className="px-2 py-2">{formatNumberRange(unitsRange, 0)}</td>
                              <td className="px-2 py-2">{formatNumberRange(hoursRange, 0)}</td>
                              <td className="px-2 py-2 font-semibold">{premium(formatCurrencyRange(currency, costRange, rates))}</td>
                            </tr>
                          );
                        })()
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-[color:var(--line)] px-3 py-3 text-xs text-[color:var(--muted)]">{t("pending")}</div>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2">
                <Label>Paint Panel + Color Codes</Label>
                <Info text="Paint palette is calibrated from detected image colors, with quantity and procurement status ranges." />
              </div>
              {baseValid && resourcePlan ? (
                <div className="mt-2 overflow-x-auto rounded-2xl border border-[color:var(--line)]">
                  <table className="w-full border-collapse text-[10px] text-[color:var(--text)]">
                    <thead className="bg-[color:var(--card-weak)]">
                      <tr>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Zone</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Shade</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Code</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Liters</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paintRows.map((item) => (
                        (() => {
                          const litersRange = toRange(item.liters, uncertainty * 0.45, 1);
                          return (
                            <tr key={item.zone} className="border-t border-[color:var(--line)]">
                              <td className="px-2 py-2 font-semibold">{item.zone}</td>
                              <td className="px-2 py-2">{item.shade}</td>
                              <td className="px-2 py-2">
                                <span className="inline-flex items-center gap-1">
                                  <span className="inline-block h-3 w-3 rounded-full border border-[color:var(--line)]" style={{ background: item.colorCode }} />
                                  {item.colorCode}
                                </span>
                              </td>
                              <td className="px-2 py-2">{formatNumberRange(litersRange, 0)}</td>
                              <td className="px-2 py-2 font-semibold">{item.status}</td>
                            </tr>
                          );
                        })()
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-[color:var(--line)] px-3 py-3 text-xs text-[color:var(--muted)]">{t("pending")}</div>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2">
                <Label>Material Quantities + Location Cost</Label>
                <Info text="Includes cement, bricks, steel, screws, plates, hinges, joints, windows, and service lines." />
              </div>
              {baseValid && resourcePlan ? (
                <div className="mt-2 overflow-x-auto rounded-2xl border border-[color:var(--line)]">
                  <table className="w-full border-collapse text-[10px] text-[color:var(--text)]">
                    <thead className="bg-[color:var(--card-weak)]">
                      <tr>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Item</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Qty</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Avail</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Unit Cost</th>
                        <th className="px-2 py-2 text-left text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resourcePlan.materials.map((item) => (
                        (() => {
                          const qtyRange = toRange(item.quantity, uncertainty * 0.75, item.unit === "ton" ? 1 : 5);
                          const unitCostRange = toRange(item.unitCostUsd, uncertainty * 0.45, 0);
                          const totalCostRangeRow = toRange(item.totalCostUsd, uncertainty, 0);
                          return (
                            <tr key={item.item} className="border-t border-[color:var(--line)]">
                              <td className="px-2 py-2 font-semibold">{item.item}</td>
                              <td className="px-2 py-2">{formatNumberRange(qtyRange, 0)} {item.unit}</td>
                              <td className="px-2 py-2">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${availabilityPill(item.availability)}`}>
                                  {item.availability}
                                </span>
                              </td>
                              <td className="px-2 py-2">{premium(formatCurrencyRange(currency, unitCostRange, rates))}</td>
                              <td className="px-2 py-2 font-semibold">{premium(formatCurrencyRange(currency, totalCostRangeRow, rates))}</td>
                            </tr>
                          );
                        })()
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-[color:var(--line)] px-3 py-3 text-xs text-[color:var(--muted)]">{t("pending")}</div>
              )}
            </div>

            <div className="mt-4">
              <Label>Procurement Insight Refresh</Label>
              <Button
                onClick={runAdvanced}
                disabled={!baseValid || advLoading || paywalled}
                className={`mt-2 w-full ${baseValid && !paywalled ? "" : "opacity-60"}`}
              >
                {advLoading ? "Running" : "Refresh Procurement Insights"}
              </Button>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">{t("assumptions")}</summary>
              <ul className="mt-2 list-none space-y-1 pl-0 text-xs font-semibold text-[color:var(--muted)]">
                <li>{t("photoEstimate")}</li>
                <li>{t("indicative")}</li>
                {(base?.notes ?? []).slice(0, 4).map((note, i) => (
                  <li key={`note-${i}`} className="whitespace-normal break-normal [overflow-wrap:break-word]">
                    {trAnswer(note)}
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        </div>
      </main>
    </div>
  );
}
