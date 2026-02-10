import tuning from "@/config/valuation-tuning.json";

export type StageLabel = "Planning" | "Foundation" | "Structure" | "Services" | "Finishing" | "Completed";

type DensityBand = "low" | "medium" | "high";
type MarketClass =
  | "Residential"
  | "Commercial"
  | "Industrial"
  | "Agricultural"
  | "Recreational/Cultural"
  | "Institutional"
  | "Mixed-use"
  | "Infrastructure";

type TypologyBasis = "built_up" | "land_only";

type GeoFactors = {
  terrain?: string;
  soil_condition?: string;
  climate_zone?: string;
  population_density?: string;
  master_plan_zone?: string;
  policy_posture?: string;
  policy_focus?: string;
  comparable_activity?: string;
  comparable_properties_count?: number;
  city_growth_5y_percent?: number;
  property_growth_percent?: number;
  land_growth_percent?: number;
  property_age_years?: number;
  resale_value_percent?: number;
  investment_roi_percent?: number;
};

type CategoryRow = {
  Category?: string;
  Typology?: string;
  Style?: string;
  AdditionalFeatures?: string;
  Exterior?: string;
};

type TypologyAnchor = {
  class?: string;
  base?: number;
  max?: number;
  aliases?: string[];
  basis?: TypologyBasis;
};

type ResolvedTypology = {
  key: string;
  marketClass: MarketClass;
  basis: TypologyBasis;
  baseRate: number;
  maxRate: number;
  source: "alias" | "classFallback";
};

export type ValuationInput = {
  projectType: string;
  scale: string;
  status: string;
  stageLabel: StageLabel;
  progressValue: number;
  location: string;
  note: string;
  geoStatus: "exif" | "gps" | "manual" | "denied" | "none";
  categoryRow: CategoryRow | null;
  geoFactors: GeoFactors | undefined;
};

export type ValuationResult = {
  property: { base: number; low: number; high: number };
  land: { base: number; low: number; high: number };
  project: { base: number; low: number; high: number };
  confidence: number;
  spread: number;
  warnings: string[];
  metrics: {
    cityGrowthPct: number;
    propertyGrowthPct: number;
    landGrowthPct: number;
    propertyAgeYears: number;
    resaleValuePct: number;
    roiPct: number;
    comparableCount: number;
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function roundStep(value: number) {
  if (value >= 1_000_000_000) return 5_000_000;
  if (value >= 100_000_000) return 1_000_000;
  if (value >= 10_000_000) return 100_000;
  if (value >= 1_000_000) return 25_000;
  return 5_000;
}

function roundTo(value: number, step: number) {
  if (!Number.isFinite(value)) return value;
  return Math.round(value / step) * step;
}

function includesAny(source: string, parts: string[]) {
  return parts.some((part) => source.includes(part));
}

function normalizeText(value?: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+\s-]+/g, " ")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function densityBandFromText(value?: string) {
  const text = (value ?? "").toLowerCase();
  if (text.includes("high")) return "high" as DensityBand;
  if (text.includes("low")) return "low" as DensityBand;
  return "medium" as DensityBand;
}

function readMetric(name: string, value: unknown, fallback: number, min: number, max: number, warnings: string[]) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    warnings.push(`${name}:missing`);
    return fallback;
  }
  if (parsed < min || parsed > max) warnings.push(`${name}:clamped`);
  return clamp(parsed, min, max);
}

function zoneLooksCompatible(projectType: string, zoneText: string) {
  const type = projectType.toLowerCase();
  const zone = zoneText.toLowerCase();
  if (!zone.trim()) return true;
  if (type.includes("residential")) return zone.includes("residential") || zone.includes("mixed");
  if (type.includes("commercial")) return zone.includes("commercial") || zone.includes("mixed") || zone.includes("business");
  if (type.includes("industrial")) return zone.includes("industrial") || zone.includes("logistics") || zone.includes("mixed");
  if (type.includes("mixed")) return zone.includes("mixed") || zone.includes("commercial") || zone.includes("residential");
  if (type.includes("infrastructure")) return zone.includes("infrastructure") || zone.includes("corridor") || zone.includes("industrial");
  return true;
}

function modelSpreadFromConfidence(confidence: number) {
  const table = [...tuning.spreadByConfidence].sort((a, b) => b.min - a.min);
  return table.find((row) => confidence >= row.min)?.spread ?? 0.32;
}

function normalizeMarketClass(value?: string): MarketClass {
  const text = normalizeText(value);
  if (!text) return "Residential";
  if (text.includes("mixed")) return "Mixed-use";
  if (text.includes("infra")) return "Infrastructure";
  if (text.includes("industrial") || text.includes("logistic") || text.includes("factory") || text.includes("warehouse")) return "Industrial";
  if (text.includes("commercial") || text.includes("office") || text.includes("retail") || text.includes("hotel")) return "Commercial";
  if (text.includes("agric") || text.includes("farm") || text.includes("barn") || text.includes("silo")) return "Agricultural";
  if (text.includes("recreat") || text.includes("cultural") || text.includes("stadium") || text.includes("museum") || text.includes("zoo")) {
    return "Recreational/Cultural";
  }
  if (text.includes("institution") || text.includes("school") || text.includes("college") || text.includes("hospital") || text.includes("university")) {
    return "Institutional";
  }
  return "Residential";
}

function asNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveTypology(
  input: {
    typology?: string;
    category?: string;
    projectType?: string;
    note?: string;
  },
  warnings: string[]
): ResolvedTypology {
  const anchors = (tuning as any).typologyAnchorsUsdPerSqm as Record<string, TypologyAnchor>;
  const classFallback = (tuning as any).typologyClassFallbackUsdPerSqm as Record<string, { base?: number; max?: number }>;

  const typologyText = normalizeText(input.typology);
  const expandedText = normalizeText(`${input.typology ?? ""} ${input.note ?? ""} ${input.projectType ?? ""} ${input.category ?? ""}`);

  let bestMatch:
    | {
        key: string;
        score: number;
        anchor: TypologyAnchor;
      }
    | undefined;

  for (const [key, anchor] of Object.entries(anchors)) {
    const aliases = Array.isArray(anchor.aliases) ? anchor.aliases : [];
    for (const alias of aliases) {
      const normalizedAlias = normalizeText(alias);
      if (!normalizedAlias) continue;

      let score = 0;
      if (typologyText === normalizedAlias) {
        score = 300 + normalizedAlias.length;
      } else if (typologyText && typologyText.includes(normalizedAlias)) {
        score = 220 + normalizedAlias.length;
      } else if (expandedText && expandedText.includes(normalizedAlias)) {
        score = 120 + normalizedAlias.length;
      }

      if (!score) continue;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { key, score, anchor };
      }
    }
  }

  if (bestMatch) {
    const marketClass = normalizeMarketClass(bestMatch.anchor.class ?? input.category ?? input.projectType);
    const baseRate = clamp(asNumber(bestMatch.anchor.base, 800), 100, 200_000);
    const maxRate = clamp(asNumber(bestMatch.anchor.max, 6_000), baseRate + 1, 300_000);
    return {
      key: bestMatch.key,
      marketClass,
      basis: bestMatch.anchor.basis === "land_only" ? "land_only" : "built_up",
      baseRate,
      maxRate,
      source: "alias"
    };
  }

  const inferredClass = normalizeMarketClass(input.category ?? input.typology ?? input.projectType);
  const fallbackClassBand = classFallback[inferredClass] ?? classFallback.Residential ?? { base: 800, max: 6_000 };
  if (!typologyText) warnings.push("typology:missing");
  else warnings.push("typology:class_fallback");

  const baseRate = clamp(asNumber(fallbackClassBand.base, 800), 100, 200_000);
  const maxRate = clamp(asNumber(fallbackClassBand.max, 6_000), baseRate + 1, 300_000);

  return {
    key: `${inferredClass} fallback`,
    marketClass: inferredClass,
    basis: "built_up",
    baseRate,
    maxRate,
    source: "classFallback"
  };
}

function getBuiltAreaSqm(marketClass: MarketClass, projectClass: MarketClass, scale: string, warnings: string[]) {
  const table = (tuning as any).builtAreaSqmDefaults as Record<string, Record<string, number>>;
  const classTable = table[marketClass] ?? table[projectClass] ?? table.Residential;

  if (!classTable) {
    warnings.push("built_area:fallback");
    return 180;
  }

  const exactScale = classTable[scale];
  if (Number.isFinite(exactScale)) {
    return clamp(Number(exactScale), 20, 2_500_000);
  }

  warnings.push("built_area:scale_fallback");
  const fallbackScaleValue = classTable["Low-rise"];
  if (Number.isFinite(fallbackScaleValue)) {
    return clamp(Number(fallbackScaleValue), 20, 2_500_000);
  }

  warnings.push("built_area:default");
  return 180;
}

function makeBand(baseValue: number, rangeSpread: number) {
  const step = roundStep(baseValue);
  const low = roundTo(baseValue * (1 - rangeSpread - tuning.haircuts.lowSideExtra), step);
  const high = roundTo(baseValue * (1 + rangeSpread + tuning.haircuts.highSideExtra), step);
  return {
    base: roundTo(baseValue, step),
    low: Math.max(tuning.limits.minValue, Math.min(low, high - step)),
    high: Math.min(tuning.limits.maxValue, Math.max(high, low + step))
  };
}

export function computeValuation(input: ValuationInput): ValuationResult {
  const warnings: string[] = [];
  const geo = input.geoFactors ?? {};

  const cityGrowthPct = readMetric("city_growth_5y_percent", geo.city_growth_5y_percent, 8, -20, 55, warnings);
  const propertyGrowthPct = readMetric("property_growth_percent", geo.property_growth_percent, 9, -25, 70, warnings);
  const landGrowthPct = readMetric("land_growth_percent", geo.land_growth_percent, 10, -25, 85, warnings);
  const propertyAgeYears = readMetric("property_age_years", geo.property_age_years, 8, 0, 120, warnings);
  const resaleValuePct = readMetric("resale_value_percent", geo.resale_value_percent, 100, 40, 220, warnings);
  const roiPct = readMetric("investment_roi_percent", geo.investment_roi_percent, 8, -20, 45, warnings);
  const comparableCount = Math.round(readMetric("comparable_properties_count", geo.comparable_properties_count, 0, 0, 200, warnings));

  const densityBand = densityBandFromText(geo.population_density);
  const projectType = input.projectType || "Residential";
  const scale = input.scale || "Low-rise";
  const projectClass = normalizeMarketClass(projectType);

  const resolvedTypology = resolveTypology(
    {
      typology: input.categoryRow?.Typology,
      category: input.categoryRow?.Category,
      projectType,
      note: input.note
    },
    warnings
  );

  let builtArea = getBuiltAreaSqm(resolvedTypology.marketClass, projectClass, scale, warnings);
  if (!Number.isFinite(builtArea) || builtArea <= 0) {
    builtArea = 180;
    warnings.push("built_area:invalid");
  }

  const context = `${input.location} ${input.note} ${input.categoryRow?.Typology ?? ""} ${input.categoryRow?.Style ?? ""} ${input.categoryRow?.Exterior ?? ""} ${input.categoryRow?.AdditionalFeatures ?? ""} ${geo.terrain ?? ""} ${geo.soil_condition ?? ""} ${geo.climate_zone ?? ""}`.toLowerCase();

  let locationFactor = 1;
  let locationPositionShift = 0;
  if (includesAny(context, tuning.locationSignals.ultraPrime)) {
    locationFactor = 1.22;
    locationPositionShift = 0.22;
  } else if (includesAny(context, tuning.locationSignals.prime)) {
    locationFactor = 1.12;
    locationPositionShift = 0.11;
  } else if (includesAny(context, tuning.locationSignals.budget)) {
    locationFactor = 0.9;
    locationPositionShift = -0.12;
  } else if (densityBand === "high") {
    locationFactor = 1.06;
    locationPositionShift = 0.05;
  } else if (densityBand === "low") {
    locationFactor = 0.95;
    locationPositionShift = -0.04;
  }

  const typologyBaseRate = resolvedTypology.baseRate;
  const typologyMaxRate = resolvedTypology.maxRate;
  const typologyBand = Math.max(1, typologyMaxRate - typologyBaseRate);

  const densityPosition = densityBand === "high" ? 0.72 : densityBand === "low" ? 0.28 : 0.5;
  const growthPositionShift = clamp((cityGrowthPct * 0.35 + propertyGrowthPct * 0.45 + landGrowthPct * 0.2) / 480, -0.14, 0.16);
  const preModifierPosition = clamp(densityPosition + locationPositionShift + growthPositionShift, 0.02, 0.98);

  // Step 2: lock to typology base/max before A-F adjustments.
  const baseRateWithinBand = clamp(typologyBaseRate + typologyBand * preModifierPosition, typologyBaseRate, typologyMaxRate);

  const comparableActivityText = (geo.comparable_activity ?? "moderate").toLowerCase();
  const comparableActivityFactor = comparableActivityText.includes("high")
    ? 1.06
    : comparableActivityText.includes("low") || comparableActivityText.includes("thin")
      ? 0.93
      : 1;

  const minComps = tuning.limits.minComparablesForAnchor;
  const comparableDepthFactor = clamp(0.9 + Math.log1p(comparableCount) * 0.085, 0.88, 1.22);
  const comparableSignal = clamp(comparableActivityFactor * comparableDepthFactor, 0.82, 1.26);
  const cityBandFallback = clamp(0.94 + cityGrowthPct / 420 + (densityBand === "high" ? 0.03 : densityBand === "low" ? -0.03 : 0), 0.84, 1.14);

  let componentComparableFactor = cityBandFallback;
  if (comparableCount >= minComps) {
    componentComparableFactor = comparableSignal;
  } else if (comparableCount > 0) {
    const blend = comparableCount / minComps;
    componentComparableFactor = clamp(cityBandFallback * (1 - blend) + comparableSignal * blend, 0.84, 1.2);
    warnings.push("comparables:thin_sample");
  } else {
    warnings.push("comparables:none_fallback_city_band");
  }

  const accessPositive = ["metro", "transit", "highway", "arterial", "corner", "frontage", "wide road", "main road"];
  const accessNegative = ["narrow", "landlocked", "inner lane", "encroach", "bottleneck"];
  const microAccessFactor = clamp(
    1 + accessPositive.filter((term) => context.includes(term)).length * 0.015 - accessNegative.filter((term) => context.includes(term)).length * 0.03,
    0.84,
    1.16
  );
  const neighborhoodFactor = densityBand === "high" ? 1.04 : densityBand === "low" ? 0.96 : 1;
  const componentMicroFactor = clamp(microAccessFactor * neighborhoodFactor * locationFactor, 0.8, 1.22);

  const hazardTerms = ["flood", "coast", "coastal", "seismic", "fault", "landslide", "swamp", "marsh", "erosion", "cyclone"];
  const hazardCount = hazardTerms.filter((term) => context.includes(term)).length;
  const soilPenalty = /(soft|expansive|black cotton|clay)/.test(context) ? 0.05 : 0;
  const terrainPenalty = /(slope|steep|hill)/.test(context) ? 0.04 : 0;
  const climatePenalty = /(extreme heat|extreme cold|storm|cyclone|hurricane)/.test(context) ? 0.03 : 0;
  const componentGeoFactor = clamp(1 - hazardCount * 0.03 - soilPenalty - terrainPenalty - climatePenalty, 0.72, 1.06);

  const policyText = (geo.policy_posture ?? "balanced").toLowerCase();
  const zoneText = (geo.master_plan_zone ?? "").toLowerCase();
  const zoneFit = zoneLooksCompatible(projectType, zoneText);

  const policyFactor = policyText.includes("unpredict")
    ? 0.9
    : policyText.includes("pro-industry") && resolvedTypology.marketClass === "Industrial"
      ? 1.08
      : policyText.includes("pro-commerce") && resolvedTypology.marketClass === "Commercial"
        ? 1.08
        : policyText.includes("pro-residential") && resolvedTypology.marketClass === "Residential"
          ? 1.06
          : policyText.includes("pro-infrastructure") && resolvedTypology.marketClass === "Infrastructure"
            ? 1.07
            : policyText.includes("pro-institutions") && resolvedTypology.marketClass === "Institutional"
              ? 1.06
              : policyText.includes("mixed")
                ? 1.02
                : 1;
  const zoneFactor = zoneFit ? 1.03 : 0.86;
  const componentPolicyFactor = clamp(policyFactor * zoneFactor, 0.78, 1.16);

  const ageFactor = clamp(1 - Math.max(0, propertyAgeYears - 2) * 0.011, 0.5, 1.04);
  const resaleFactor = clamp(resaleValuePct / 100, 0.62, 1.45);
  const complianceFactor = /(unauthori|non-compliant|violation|litigation)/.test(context) ? 0.84 : 1;
  const componentAgeResaleFactor = clamp(ageFactor * resaleFactor * complianceFactor, 0.5, 1.24);

  const growthMomentum = clamp(1 + (cityGrowthPct * 0.25 + propertyGrowthPct * 0.45 + landGrowthPct * 0.3) / 280, 0.78, 1.32);
  const liquidityDepth = clamp(0.9 + comparableCount / 140, 0.9, 1.2);
  const componentLiquidityFactor = clamp(growthMomentum * comparableActivityFactor * liquidityDepth, 0.78, 1.3);

  const weights = tuning.weights;
  const weightedRateModifier = clamp(
    1 +
      (componentComparableFactor - 1) * weights.comparableAnchor +
      (componentMicroFactor - 1) * weights.microMarket +
      (componentGeoFactor - 1) * weights.geo +
      (componentPolicyFactor - 1) * weights.policyZoning +
      (componentAgeResaleFactor - 1) * weights.ageResale +
      (componentLiquidityFactor - 1) * weights.liquidity,
    0.72,
    1.34
  );

  // Step 3/4: apply A-F modifiers and cap back to typology band.
  const rawUnitRate = baseRateWithinBand * weightedRateModifier;
  const finalUnitRate = clamp(rawUnitRate, typologyBaseRate, typologyMaxRate);
  if (Math.abs(finalUnitRate - rawUnitRate) > 0.5) warnings.push("unit_rate:typology_clamped");

  const builtBase = clamp(finalUnitRate * builtArea, tuning.limits.minValue, tuning.limits.maxValue);

  const landAreaMultiplier =
    (tuning.landAreaMultiplierByScale as Record<string, number>)[scale] ?? (tuning.landAreaMultiplierByScale as Record<string, number>)["Low-rise"] ?? 1.6;
  const landRateMultiplierByType = tuning.landRateMultiplierByType as Record<string, number>;
  const landRateMultiplier =
    landRateMultiplierByType[resolvedTypology.marketClass] ?? landRateMultiplierByType[projectClass] ?? landRateMultiplierByType.Residential ?? 0.5;

  const landAnchor = builtArea * landAreaMultiplier * finalUnitRate * landRateMultiplier;
  const landGrowthFactor = clamp(1 + landGrowthPct / 230, 0.76, 1.4);
  const rawLandBase = landAnchor * landGrowthFactor * zoneFactor * policyFactor;
  let landBase = clamp(rawLandBase, tuning.limits.minValue, tuning.limits.maxValue);

  if (resolvedTypology.basis !== "land_only") {
    const maxLandRatio =
      resolvedTypology.marketClass === "Agricultural" ? 1.25 : resolvedTypology.marketClass === "Infrastructure" ? 1.15 : 0.9;
    const landCap = builtBase * maxLandRatio;
    if (landBase > landCap) {
      landBase = landCap;
      warnings.push("land:share_capped");
    }
  }

  const clampToTypologyBandValue = (value: number, warnKey: string) => {
    const unitRate = value / Math.max(1, builtArea);
    const clampedUnitRate = clamp(unitRate, typologyBaseRate, typologyMaxRate);
    if (Math.abs(unitRate - clampedUnitRate) > 0.5) warnings.push(warnKey);
    return clamp(clampedUnitRate * builtArea, tuning.limits.minValue, tuning.limits.maxValue);
  };

  const propertyBase =
    resolvedTypology.basis === "land_only"
      ? clampToTypologyBandValue(landBase, "property:typology_clamped")
      : builtBase;

  const completionByStage = tuning.completionByStage[input.stageLabel] ?? 0.45;
  const completionShare = input.status === "Completed" ? 1 : clamp((completionByStage + input.progressValue / 100) / 2, 0.08, 0.98);
  const rawProjectBase = resolvedTypology.basis === "land_only" ? landBase : landBase + builtBase * completionShare;
  const projectBase = clampToTypologyBandValue(rawProjectBase, "project:typology_clamped");

  let confidence = tuning.confidence.base;
  if (!input.location.trim()) confidence -= tuning.confidence.missingLocationPenalty;
  if (input.geoStatus === "none" || input.geoStatus === "denied") confidence -= tuning.confidence.missingGpsPenalty;
  if (comparableCount === 0) confidence -= tuning.confidence.noComparablesPenalty;
  else if (comparableCount < minComps) confidence -= tuning.confidence.fewComparablesPenalty;
  else if (comparableCount >= tuning.limits.strongComparables) confidence += tuning.confidence.strongComparablesBonus;
  if (!zoneFit) confidence -= tuning.confidence.zoneMismatchPenalty;
  else confidence += tuning.confidence.clearZoneFitBonus;
  if (hazardCount >= 2) confidence -= tuning.confidence.highHazardPenalty;
  else confidence += tuning.confidence.lowHazardBonus;
  if (policyText.includes("unpredict")) confidence -= tuning.confidence.policyUncertainPenalty;
  if (Math.abs(propertyGrowthPct - landGrowthPct) < 8 && Math.abs(cityGrowthPct - propertyGrowthPct) < 10) confidence += tuning.confidence.stableGrowthBonus;
  if (!input.categoryRow?.Typology) confidence -= 8;
  if (resolvedTypology.source === "classFallback") confidence -= 10;

  const classMismatch =
    resolvedTypology.marketClass !== projectClass && projectClass !== "Mixed-use" && resolvedTypology.marketClass !== "Mixed-use";
  if (classMismatch) {
    confidence -= 12;
    warnings.push("class:signal_mismatch");
  }

  const dedupedWarnings = Array.from(new Set(warnings));
  confidence -= Math.min(10, dedupedWarnings.filter((item) => item.endsWith(":missing")).length * 2);
  confidence = clamp(confidence, tuning.limits.minConfidence, tuning.limits.maxConfidence);

  let spread = modelSpreadFromConfidence(confidence);
  if (comparableCount < minComps) spread += tuning.haircuts.fallbackNoCompsExtraSpread;
  if (hazardCount >= 2) spread += tuning.haircuts.hazardExtraSpread;
  if (resolvedTypology.source === "classFallback") spread += 0.04;
  if (classMismatch) spread += 0.03;
  spread += Math.min(dedupedWarnings.length, tuning.limits.maxWarningsForSpread) * 0.01;
  spread = clamp(spread, 0.1, 0.58);

  const projectSpread = clamp(spread + (input.status === "Completed" ? -0.03 : 0.04), 0.1, 0.62);
  const landSpread = clamp(spread - 0.03, 0.08, 0.5);

  if ((import.meta as any).env?.DEV && dedupedWarnings.length) {
    // Internal diagnostics for pricing root-cause checks.
    // eslint-disable-next-line no-console
    console.warn("[valuation]", {
      warnings: dedupedWarnings,
      typology: resolvedTypology,
      unitRateUsdPerSqm: Number(finalUnitRate.toFixed(2)),
      builtAreaSqm: Math.round(builtArea)
    });
  }

  return {
    property: makeBand(propertyBase, spread),
    land: makeBand(landBase, landSpread),
    project: makeBand(projectBase, projectSpread),
    confidence,
    spread,
    warnings: dedupedWarnings,
    metrics: {
      cityGrowthPct,
      propertyGrowthPct,
      landGrowthPct,
      propertyAgeYears,
      resaleValuePct,
      roiPct,
      comparableCount
    }
  };
}
