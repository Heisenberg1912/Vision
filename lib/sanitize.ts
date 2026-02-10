import { z } from "zod";
import { CATEGORY_ROWS } from "./category-data";
import { BaseResultSchema, AdvancedResultSchema } from "./schema";

export type StageName = "Planning" | "Foundation" | "Structure" | "Services" | "Finishing" | "Completed";

export const STAGE_RANGES: Record<StageName, { min: number; max: number }> = {
  Planning: { min: 0, max: 5 },
  Foundation: { min: 5, max: 20 },
  Structure: { min: 20, max: 55 },
  Services: { min: 55, max: 75 },
  Finishing: { min: 75, max: 95 },
  Completed: { min: 100, max: 100 }
};

export const ADV_STAGE_RANGES: Record<string, { min: number; max: number }> = {
  Planning: { min: 0, max: 5 },
  Foundation: { min: 5, max: 20 },
  Structure: { min: 20, max: 55 },
  Services: { min: 55, max: 75 },
  Finishing: { min: 75, max: 95 },
  Completed: { min: 100, max: 100 }
};

export const AnalyzeBody = z.object({
  imageDataUrl: z.string().min(20),
  meta: z
    .object({
      location: z.string().optional(),
      projectType: z.string().optional(),
      scale: z.string().optional(),
      constructionType: z.string().optional(),
      note: z.string().optional(),
      language: z.string().optional(),
      currency: z.string().optional()
    })
    .default({})
});

export const AdvancedBody = z.object({
  imageDataUrl: z.string().min(20),
  base: BaseResultSchema,
  language: z.string().optional()
});

export const TranslateBody = z.object({
  language: z.string().min(2).max(64),
  texts: z.array(z.string().max(1200)).max(40)
});

export function normalizeStage(value: unknown): StageName {
  if (typeof value !== "string") return "Planning";
  const v = value.toLowerCase();
  if (v.includes("plan")) return "Planning";
  if (v.includes("found")) return "Foundation";
  if (v.includes("struct") || v.includes("frame")) return "Structure";
  if (v.includes("service") || v.includes("mep") || v.includes("electric") || v.includes("plumb")) return "Services";
  if (v.includes("finish") || v.includes("interior") || v.includes("paint")) return "Finishing";
  if (v.includes("complete")) return "Completed";
  return "Structure";
}

export function clampProgress(stage: StageName, value: number) {
  const range = STAGE_RANGES[stage];
  return Math.min(range.max, Math.max(range.min, value));
}

function uniqStages(value: unknown) {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map((item) => normalizeStage(item))
    .filter((item) => item !== "Completed");
  return Array.from(new Set(cleaned)).slice(0, 5);
}

function hasAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function inferLikelyCompleted(input: any, metaNote?: string) {
  const notes = Array.isArray(input?.notes) ? input.notes.join(" ") : "";
  const scopeLeft = Array.isArray(input?.scope?.stages_left) ? input.scope.stages_left.length : null;
  const scopeDone = Array.isArray(input?.scope?.stages_completed) ? input.scope.stages_completed.length : null;
  const scopeLeftText = Array.isArray(input?.scope?.stages_left) ? input.scope.stages_left.join(" ") : "";
  const scopeDoneText = Array.isArray(input?.scope?.stages_completed) ? input.scope.stages_completed.join(" ") : "";
  const text = [
    String(input?.project_status ?? ""),
    String(input?.stage_of_construction ?? ""),
    String(input?.category_matrix?.Style ?? ""),
    String(input?.category_matrix?.Exterior ?? ""),
    String(input?.category_matrix?.AdditionalFeatures ?? ""),
    String(metaNote ?? ""),
    notes,
    scopeLeftText,
    scopeDoneText
  ]
    .join(" ")
    .toLowerCase();

  const completedTerms = [
    "completed", "completion", "handover", "ready to occupy", "occupied",
    "fully finished", "commissioned", "operational", "final finish",
    "landscaping complete", "finished facade", "facade complete",
    "handover ready", "ready for possession", "no active work", "no scaffolding"
  ];
  const ongoingTerms = [
    "under construction", "excavation", "foundation", "rebar", "formwork",
    "scaffold", "shuttering", "unfinished", "rough-in", "plaster pending",
    "painting pending", "exposed rebar", "open formwork", "active site work"
  ];

  let score = 0;
  if (hasAnyTerm(text, completedTerms)) score += 2;
  if (hasAnyTerm(text, ongoingTerms)) score -= 3;
  if (hasAnyTerm(scopeLeftText.toLowerCase(), ["planning", "foundation", "structure", "services", "finishing"])) score -= 1;

  const progress = Number(input?.progress_percent);
  if (Number.isFinite(progress) && progress >= 98) score += 3;
  else if (Number.isFinite(progress) && progress >= 95) score += 2;
  if (Number.isFinite(progress) && progress <= 82) score -= 2;

  const hours = Number(input?.timeline?.hours_remaining);
  if (Number.isFinite(hours) && hours <= 12) score += 2;
  else if (Number.isFinite(hours) && hours <= 36) score += 1;
  if (Number.isFinite(hours) && hours >= 220) score -= 2;

  const stage = normalizeStage(input?.stage_of_construction);
  if (stage === "Completed") score += 3;
  if (stage === "Finishing" && Number.isFinite(progress) && progress >= 90) score += 1;

  if (scopeLeft === 0) score += 2;
  if (scopeLeft === 1 && scopeDone !== null && scopeDone >= 3) score += 1;
  if (scopeLeft !== null && scopeLeft >= 3) score -= 2;
  if (scopeDone !== null && scopeDone >= 4) score += 1;

  if (hasAnyTerm(text, ongoingTerms) && !Number.isFinite(progress)) return false;
  return score >= 3;
}

export function sanitizeBase(
  input: any,
  meta?: {
    location?: string;
    projectType?: string;
    scale?: string;
    constructionType?: string;
    note?: string;
  }
) {
  if (!input || typeof input !== "object") return input;
  const metaProjectType = meta?.projectType;
  let status = input.project_status === "completed" ? "completed" : "under_construction";
  let stage = normalizeStage(input.stage_of_construction);
  let progress = Number.isFinite(input.progress_percent) ? Number(input.progress_percent) : 0;
  const declaredTimeline = input.timeline ?? {};
  const declaredHoursRaw = Number(declaredTimeline.hours_remaining);
  const declaredHoursKnown = Number.isFinite(declaredHoursRaw);
  const declaredHours = declaredHoursKnown ? Math.max(0, declaredHoursRaw) : null;
  const scopeLeftCount = Array.isArray(input?.scope?.stages_left) ? input.scope.stages_left.length : null;

  if (status !== "completed" && inferLikelyCompleted(input, meta?.note)) {
    status = "completed";
  }

  if (
    status !== "completed" &&
    stage === "Finishing" &&
    progress >= 95 &&
    declaredHours !== null &&
    declaredHours <= 24 &&
    (scopeLeftCount === null || scopeLeftCount <= 1)
  ) {
    status = "completed";
  }

  if (status === "completed") {
    stage = "Completed";
    progress = 100;
  } else if (stage === "Completed" && progress < 100) {
    stage = "Finishing";
  }

  progress = clampProgress(stage, progress);

  const timeline = input.timeline ?? {};
  let hoursRemaining = status === "completed" ? 0 : Math.max(0, Number(timeline.hours_remaining) || 0);
  let manpowerHours = Math.max(0, Number(timeline.manpower_hours) || 0);
  let machineryHours = Math.max(0, Number(timeline.machinery_hours) || 0);

  if (status !== "completed") {
    const stageDefaults: Record<StageName, number> = {
      Planning: 300,
      Foundation: 900,
      Structure: 1500,
      Services: 800,
      Finishing: 600,
      Completed: 0
    };
    if (hoursRemaining === 0 && manpowerHours === 0 && machineryHours === 0) {
      const fallback = stageDefaults[stage] || 600;
      hoursRemaining = fallback;
      manpowerHours = Math.round(fallback * 0.65);
      machineryHours = Math.round(fallback * 0.35);
    } else if (hoursRemaining > 0 && manpowerHours === 0 && machineryHours === 0) {
      manpowerHours = Math.round(hoursRemaining * 0.65);
      machineryHours = Math.round(hoursRemaining * 0.35);
    }
  }

  const cleanField = (value: unknown, fallback: string) => {
    if (typeof value === "string" && value.trim().length) return value.trim();
    return fallback;
  };
  const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };
  const matrix = input.category_matrix ?? {};
  const findRow = () => {
    const typology = typeof matrix.Typology === "string" ? matrix.Typology.toLowerCase() : "";
    const category = typeof matrix.Category === "string" ? matrix.Category.toLowerCase() : "";
    let match = CATEGORY_ROWS.find((row: (typeof CATEGORY_ROWS)[number]) => row.Typology.toLowerCase() === typology);
    if (!match && category) {
      match = CATEGORY_ROWS.find((row: (typeof CATEGORY_ROWS)[number]) => row.Category.toLowerCase() === category);
    }
    if (!match && metaProjectType) {
      const fallbackCategory = metaProjectType.toLowerCase();
      match = CATEGORY_ROWS.find((row: (typeof CATEGORY_ROWS)[number]) =>
        row.Category.toLowerCase().includes(fallbackCategory)
      );
    }
    return match ?? CATEGORY_ROWS[0];
  };
  const datasetRow = findRow();
  const geo = input.geo_market_factors ?? {};
  const projectTypeLower = String(metaProjectType ?? matrix.Category ?? "residential").toLowerCase();
  const locationLower = String(meta?.location ?? "").toLowerCase();
  const defaultDensity = locationLower.includes("metro") || locationLower.includes("city")
    ? "High"
    : locationLower.includes("rural") || locationLower.includes("village")
      ? "Low"
      : "Medium";
  const defaultMasterPlanZone =
    projectTypeLower.includes("industrial")
      ? "Industrial / Logistics Zone"
      : projectTypeLower.includes("commercial")
        ? "Commercial Business Zone"
        : projectTypeLower.includes("infrastructure")
          ? "Infrastructure Corridor"
          : projectTypeLower.includes("mixed")
            ? "Mixed-use Growth Zone"
            : "Residential / Mixed Residential Zone";
  const defaultPolicyPosture =
    projectTypeLower.includes("industrial")
      ? "Pro-industry"
      : projectTypeLower.includes("commercial")
        ? "Pro-commerce"
        : projectTypeLower.includes("infrastructure")
          ? "Pro-infrastructure"
          : projectTypeLower.includes("institution")
            ? "Pro-institutions"
            : "Pro-residential";
  const defaultPolicyFocus =
    projectTypeLower.includes("industrial")
      ? "Manufacturing and logistics expansion"
      : projectTypeLower.includes("commercial")
        ? "Retail, office, and employment density"
        : projectTypeLower.includes("infrastructure")
          ? "Transport and utility upgrades"
          : projectTypeLower.includes("mixed")
            ? "Balanced mixed-use growth"
            : "Housing-led urban expansion";
  const defaultCityGrowth = clampNumber(geo.city_growth_5y_percent, 18, -20, 120);
  const defaultPropertyGrowth = clampNumber(geo.property_growth_percent, defaultCityGrowth * 0.8, -20, 120);
  const defaultLandGrowth = clampNumber(geo.land_growth_percent, defaultPropertyGrowth + 3, -20, 140);
  const defaultAgeYears = clampNumber(
    geo.property_age_years,
    status === "completed" ? 6 : Math.max(1, Math.round((100 - progress) / 18)),
    0,
    200
  );
  const defaultResale = clampNumber(
    geo.resale_value_percent,
    100 + defaultPropertyGrowth * 0.45 - defaultAgeYears * 0.6,
    0,
    220
  );
  const defaultRoi = clampNumber(
    geo.investment_roi_percent,
    defaultPropertyGrowth * 0.6 + defaultLandGrowth * 0.35 - defaultAgeYears * 0.12,
    -50,
    120
  );
  const defaultComparableActivity =
    projectTypeLower.includes("industrial")
      ? "Moderate industrial transaction activity"
      : projectTypeLower.includes("commercial")
        ? "High commercial inventory churn"
        : "Moderate residential comparable activity";
  const defaultComparableCount = clampNumber(
    geo.comparable_properties_count,
    defaultDensity === "High" ? 42 : defaultDensity === "Low" ? 11 : 24,
    0,
    5000
  );

  return {
    project_status: status,
    stage_of_construction: stage,
    progress_percent: progress,
    timeline: {
      hours_remaining: hoursRemaining,
      manpower_hours: manpowerHours,
      machinery_hours: machineryHours
    },
    category_matrix: {
      Category: cleanField(matrix.Category, datasetRow.Category),
      Typology: cleanField(matrix.Typology, datasetRow.Typology),
      Style: cleanField(matrix.Style, datasetRow.Style),
      ClimateAdaptability: cleanField(matrix.ClimateAdaptability, datasetRow.ClimateAdaptability),
      Terrain: cleanField(matrix.Terrain, datasetRow.Terrain),
      SoilType: cleanField(matrix.SoilType, datasetRow.SoilType),
      MaterialUsed: cleanField(matrix.MaterialUsed, datasetRow.MaterialUsed),
      InteriorLayout: cleanField(matrix.InteriorLayout, datasetRow.InteriorLayout),
      RoofType: cleanField(matrix.RoofType, datasetRow.RoofType),
      Exterior: cleanField(matrix.Exterior, datasetRow.Exterior),
      AdditionalFeatures: cleanField(matrix.AdditionalFeatures, datasetRow.AdditionalFeatures),
      Sustainability: cleanField(matrix.Sustainability, datasetRow.Sustainability)
    },
    scope: {
      stages_completed: uniqStages(input.scope?.stages_completed),
      stages_left: uniqStages(input.scope?.stages_left),
      dependencies: uniqStages(input.scope?.dependencies)
    },
    geo_market_factors: {
      terrain: cleanField(geo.terrain, cleanField(matrix.Terrain, datasetRow.Terrain)),
      soil_condition: cleanField(geo.soil_condition, cleanField(matrix.SoilType, datasetRow.SoilType)),
      climate_zone: cleanField(geo.climate_zone, cleanField(matrix.ClimateAdaptability, datasetRow.ClimateAdaptability)),
      population_density: cleanField(geo.population_density, defaultDensity),
      master_plan_zone: cleanField(geo.master_plan_zone, defaultMasterPlanZone),
      policy_posture: cleanField(geo.policy_posture, defaultPolicyPosture),
      policy_focus: cleanField(geo.policy_focus, defaultPolicyFocus),
      comparable_activity: cleanField(geo.comparable_activity, defaultComparableActivity),
      comparable_properties_count: defaultComparableCount,
      city_growth_5y_percent: defaultCityGrowth,
      property_growth_percent: defaultPropertyGrowth,
      land_growth_percent: defaultLandGrowth,
      property_age_years: defaultAgeYears,
      resale_value_percent: defaultResale,
      investment_roi_percent: defaultRoi
    },
    notes: Array.isArray(input.notes) ? input.notes.slice(0, 4) : []
  };
}

export function buildFallbackBase(meta?: {
  location?: string;
  projectType?: string;
  scale?: string;
  constructionType?: string;
  note?: string;
}) {
  const fallbackInput = {
    project_status: "under_construction",
    stage_of_construction: "Structure",
    progress_percent: 42,
    timeline: {
      hours_remaining: 860,
      manpower_hours: 560,
      machinery_hours: 300
    },
    category_matrix: {
      Category: meta?.projectType ?? "Residential",
      Typology: "",
      Style: "Context inferred",
      ClimateAdaptability: "Moderate",
      Terrain: "Mixed urban terrain",
      SoilType: "Medium bearing",
      MaterialUsed: meta?.constructionType ?? "RCC",
      InteriorLayout: "Standardized",
      RoofType: "Flat",
      Exterior: "Context inferred",
      AdditionalFeatures: meta?.note ?? "",
      Sustainability: "Baseline efficiency"
    },
    scope: {
      stages_completed: ["Planning", "Foundation"],
      stages_left: ["Services", "Finishing"],
      dependencies: ["Approvals", "Supply chain"]
    },
    geo_market_factors: {
      terrain: "Mixed urban terrain",
      soil_condition: "Medium bearing capacity",
      climate_zone: "Tropical / Subtropical",
      population_density: "Medium",
      master_plan_zone: "",
      policy_posture: "",
      policy_focus: "",
      comparable_activity: "Moderate",
      comparable_properties_count: 22,
      city_growth_5y_percent: 11,
      property_growth_percent: 9,
      land_growth_percent: 10,
      property_age_years: 8,
      resale_value_percent: 102,
      investment_roi_percent: 8.5
    },
    notes: ["Fallback analysis used because Gemini request was unavailable."]
  };
  return sanitizeBase(fallbackInput, meta);
}

export function baseIsValid(base: z.infer<typeof BaseResultSchema>) {
  const range = ADV_STAGE_RANGES[base.stage_of_construction];
  if (!range) return false;
  if (base.project_status === "completed") return base.progress_percent === 100 && base.timeline.hours_remaining === 0;
  return base.progress_percent >= range.min && base.progress_percent <= range.max;
}

export function sanitizeAdvanced(input: any, base: z.infer<typeof BaseResultSchema>) {
  const fallbackSignals = ["Cost", "Pace", "Labor"];
  const geo = base.geo_market_factors;
  const fallbackRecommendations = [
    `Resource availability is moderate for this location; lock labor and machine bookings before the next stage transition.`,
    `Risk is driven by ${geo.climate_zone.toLowerCase()} and ${geo.terrain.toLowerCase()} conditions, so build contingency into procurement and schedule.`
  ];
  const progressOptions = ["Ahead", "On Track", "Delayed"] as const;
  const progress =
    typeof input?.progress_vs_ideal === "string" && progressOptions.includes(input.progress_vs_ideal as any)
      ? input.progress_vs_ideal
      : "On Track";

  const rawDrift = typeof input?.timeline_drift === "string" ? input.timeline_drift : "";
  const driftMatch = rawDrift.match(/[-+]?\d+(?:\.\d+)?%/);
  const drift = driftMatch ? driftMatch[0] : "On Track (±3%)";

  const signals = Array.isArray(input?.cost_risk_signals)
    ? Array.from(
        new Set(
          input.cost_risk_signals
            .map((item: any) => String(item).trim().split(/\s+/).slice(0, 2).join(" "))
            .filter((item: string) => item.length > 0)
        )
      ).slice(0, 5)
    : fallbackSignals;

  const recs = Array.isArray(input?.recommendations)
    ? Array.from(
        new Set(
          input.recommendations
            .map((item: any) => String(item).trim())
            .filter((item: string) => item.length >= 8)
        )
      ).slice(0, 4)
    : fallbackRecommendations;

  return {
    progress_vs_ideal: progress,
    timeline_drift: drift,
    cost_risk_signals: signals.length ? signals : fallbackSignals,
    recommendations: recs.length ? recs : fallbackRecommendations
  };
}
