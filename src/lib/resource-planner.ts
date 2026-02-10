export type StageLabel = "Planning" | "Foundation" | "Structure" | "Services" | "Finishing" | "Completed";

export type Availability = "High" | "Medium" | "Low";

export type LaborRequirement = {
  role: string;
  required: number;
  availability: Availability;
  dailyRateUsd: number;
  estimatedDays: number;
  totalCostUsd: number;
};

export type MachineryRequirement = {
  machine: string;
  units: number;
  availability: Availability;
  hourlyRateUsd: number;
  estimatedHours: number;
  totalCostUsd: number;
};

export type MaterialRequirement = {
  item: string;
  quantity: number;
  unit: string;
  availability: Availability;
  unitCostUsd: number;
  totalCostUsd: number;
};

export type PaintRequirement = {
  zone: string;
  shade: string;
  colorCode: string;
  liters: number;
  status: "Acquired" | "To Procure";
};

export type ResourcePlanOutput = {
  progressValue: number;
  laborAvailability: Availability;
  locationCostIndex: number;
  labor: LaborRequirement[];
  machinery: MachineryRequirement[];
  materials: MaterialRequirement[];
  paints: PaintRequirement[];
  components: string[];
  techniques: string[];
  specialRequirements: string[];
  vernacularMaterials: string[];
  constructionInsights: string[];
  procurementInsights: string[];
  completionInsights: string[];
};

type ResourcePlanInput = {
  status: "Completed" | "Under Construction" | "Unknown";
  stage: StageLabel;
  progressValue: number;
  projectType: string;
  scale: string;
  constructionType: string;
  location: string;
  note: string;
  category: {
    Typology?: string;
    Style?: string;
    RoofType?: string;
    MaterialUsed?: string;
    AdditionalFeatures?: string;
  } | null;
  geo:
    | {
        terrain?: string;
        soil_condition?: string;
        climate_zone?: string;
        population_density?: string;
      }
    | undefined;
  advancedRecommendations?: string[];
};

const SCALE_FACTOR: Record<string, number> = {
  "Low-rise": 1,
  "Mid-rise": 1.8,
  "High-rise": 3.4,
  "Large-site": 4.6
};

const STAGE_PRESSURE: Record<StageLabel, number> = {
  Planning: 1,
  Foundation: 0.94,
  Structure: 0.8,
  Services: 0.6,
  Finishing: 0.4,
  Completed: 0.15
};

const STAGE_ROLE_FACTOR: Record<
  string,
  Record<StageLabel, number>
> = {
  architect: { Planning: 1, Foundation: 0.8, Structure: 0.6, Services: 0.5, Finishing: 0.4, Completed: 0.2 },
  engineer: { Planning: 0.8, Foundation: 1, Structure: 1, Services: 0.9, Finishing: 0.7, Completed: 0.2 },
  mason: { Planning: 0.25, Foundation: 1, Structure: 1, Services: 0.65, Finishing: 0.35, Completed: 0.08 },
  carpenter: { Planning: 0.2, Foundation: 0.5, Structure: 0.95, Services: 0.95, Finishing: 0.75, Completed: 0.1 },
  electrician: { Planning: 0.1, Foundation: 0.2, Structure: 0.45, Services: 1, Finishing: 0.9, Completed: 0.1 },
  plumber: { Planning: 0.1, Foundation: 0.2, Structure: 0.45, Services: 1, Finishing: 0.85, Completed: 0.1 },
  painter: { Planning: 0.05, Foundation: 0.1, Structure: 0.2, Services: 0.45, Finishing: 1, Completed: 0.2 },
  steelFixer: { Planning: 0.15, Foundation: 1, Structure: 1, Services: 0.25, Finishing: 0.08, Completed: 0.05 }
};

const MATERIAL_SPECS = [
  { item: "Cement", baseQuantity: 900, unit: "bags", unitCostUsd: 7.4 },
  { item: "Bricks", baseQuantity: 78000, unit: "nos", unitCostUsd: 0.11 },
  { item: "Steel (TMT/Rebar)", baseQuantity: 62, unit: "ton", unitCostUsd: 740 },
  { item: "River Sand", baseQuantity: 320, unit: "ton", unitCostUsd: 24 },
  { item: "Aggregate 20mm", baseQuantity: 430, unit: "ton", unitCostUsd: 30 },
  { item: "Screws", baseQuantity: 24000, unit: "nos", unitCostUsd: 0.05 },
  { item: "MS Plates", baseQuantity: 680, unit: "nos", unitCostUsd: 7.5 },
  { item: "Door Hinges", baseQuantity: 360, unit: "nos", unitCostUsd: 2.8 },
  { item: "Windows", baseQuantity: 52, unit: "nos", unitCostUsd: 115 },
  { item: "Joint Sealant", baseQuantity: 540, unit: "cartridges", unitCostUsd: 6.2 },
  { item: "Plumbing Pipes", baseQuantity: 1500, unit: "m", unitCostUsd: 4.1 },
  { item: "Electrical Cables", baseQuantity: 2600, unit: "m", unitCostUsd: 1.7 }
] as const;

const MACHINERY_SPECS = [
  { machine: "Excavator", baseUnits: 1, hourlyRateUsd: 95, stageKey: "foundation" },
  { machine: "Concrete Pump", baseUnits: 1, hourlyRateUsd: 125, stageKey: "structure" },
  { machine: "Tower Crane / Hoist", baseUnits: 1, hourlyRateUsd: 180, stageKey: "structure" },
  { machine: "Rebar Cutter + Bender", baseUnits: 1, hourlyRateUsd: 38, stageKey: "structure" },
  { machine: "Scaffolding Set", baseUnits: 1, hourlyRateUsd: 22, stageKey: "services" },
  { machine: "Boom Lift", baseUnits: 1, hourlyRateUsd: 72, stageKey: "services" },
  { machine: "Paint Sprayer Rig", baseUnits: 1, hourlyRateUsd: 28, stageKey: "finishing" }
] as const;

const RISKY_TERRAIN_TERMS = ["slope", "steep", "hill", "marsh", "flood", "coastal", "landslide", "soft"];
const EXTREME_CLIMATE_TERMS = ["cyclone", "storm", "extreme", "heat", "cold", "humid", "monsoon", "snow"];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function rangeLabel(value: number, spread: number, minFloor = 0, digits = 0) {
  const delta = Math.max(value * spread, value < 10 ? 1 : 0.5);
  const min = Math.max(minFloor, value - delta);
  const max = Math.max(minFloor, value + delta);
  return `${min.toFixed(digits)}-${max.toFixed(digits)}`;
}

function normalize(value?: string) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function dedupe(items: string[], max = 5) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, max);
}

function shiftAvailability(availability: Availability, delta: number): Availability {
  const levels: Availability[] = ["Low", "Medium", "High"];
  const idx = levels.indexOf(availability);
  const shifted = clamp(idx + delta, 0, levels.length - 1);
  return levels[shifted];
}

function detectLocationCostIndex(location: string) {
  const l = normalize(location);
  const ultraHigh = ["new york", "san francisco", "london", "zurich", "singapore", "dubai", "tokyo"];
  const high = ["mumbai", "delhi", "bengaluru", "bangalore", "seattle", "toronto", "sydney", "melbourne", "paris"];
  const low = ["rural", "village", "tier-3", "small town", "remote"];
  if (ultraHigh.some((term) => l.includes(term))) return 1.26;
  if (high.some((term) => l.includes(term))) return 1.14;
  if (low.some((term) => l.includes(term))) return 0.86;
  return 1;
}

function detectLaborAvailability(
  densityText: string | undefined,
  terrainText: string | undefined,
  climateText: string | undefined,
  location: string
): Availability {
  const density = normalize(densityText);
  let availability: Availability = density.includes("high") || density.includes("metro") || density.includes("city") ? "High" : "Medium";
  if (density.includes("low") || normalize(location).includes("rural") || normalize(location).includes("village")) {
    availability = "Low";
  }

  const terrain = normalize(terrainText);
  const climate = normalize(climateText);
  const terrainRisk = RISKY_TERRAIN_TERMS.some((term) => terrain.includes(term));
  const climateRisk = EXTREME_CLIMATE_TERMS.some((term) => climate.includes(term));
  if (terrainRisk || climateRisk) {
    availability = shiftAvailability(availability, -1);
  }
  return availability;
}

function specializedAvailability(base: Availability, role: string) {
  if (role === "Architect" || role === "Site Engineer") {
    return base;
  }
  if (role === "Electricians" || role === "Plumbers") {
    return shiftAvailability(base, -1);
  }
  return base;
}

function availabilityForMaterial(base: Availability, item: string, location: string) {
  let next = base;
  const l = normalize(location);
  if (item === "Windows" || item === "Joint Sealant") {
    next = shiftAvailability(next, -1);
  }
  if (l.includes("port") || l.includes("metro") || l.includes("city")) {
    next = shiftAvailability(next, 1);
  }
  return next;
}

function stageBucket(stage: StageLabel) {
  if (stage === "Planning" || stage === "Foundation") return "foundation";
  if (stage === "Structure") return "structure";
  if (stage === "Services") return "services";
  return "finishing";
}

function paintPalette(climateText: string, progressValue: number, scaleFactor: number): PaintRequirement[] {
  const climate = normalize(climateText);
  const coastal = climate.includes("coastal") || climate.includes("humid");
  const hot = climate.includes("hot") || climate.includes("arid") || climate.includes("desert");
  const cold = climate.includes("cold") || climate.includes("snow");

  const exterior = coastal
    ? { shade: "Salt Mist Grey", colorCode: "#B7C0C8" }
    : hot
      ? { shade: "Solar Reflect White", colorCode: "#F5F2E8" }
      : cold
        ? { shade: "Thermal Taupe", colorCode: "#B29B88" }
        : { shade: "Stone Beige", colorCode: "#D5C3A5" };

  const panel = [
    { zone: "Exterior", shade: exterior.shade, colorCode: exterior.colorCode, liters: Math.round(240 * scaleFactor) },
    { zone: "Interior Walls", shade: "Warm Off-White", colorCode: "#F3EEE2", liters: Math.round(190 * scaleFactor) },
    { zone: "Utility Areas", shade: "Service Grey", colorCode: "#9CA3AF", liters: Math.round(90 * scaleFactor) },
    { zone: "Metalworks", shade: "Anti-Rust Red Oxide", colorCode: "#7E3A32", liters: Math.round(55 * scaleFactor) }
  ] as const;

  return panel.map((paint, idx) => ({
    ...paint,
    status: progressValue >= 70 - idx * 8 ? "Acquired" : "To Procure"
  }));
}

function vernacularByLocation(location: string, climate: string): string[] {
  const l = normalize(location);
  const c = normalize(climate);

  if (l.includes("kerala") || l.includes("goa") || c.includes("coastal")) {
    return ["Laterite stone blocks", "Mangalore clay tiles", "Lime-cement breathable plaster"];
  }
  if (l.includes("rajasthan") || c.includes("desert") || c.includes("hot")) {
    return ["Lime plaster with reflective finish", "Jodhpur sandstone accents", "Terracotta jaali panels"];
  }
  if (l.includes("himachal") || l.includes("uttarakhand") || c.includes("cold")) {
    return ["Local stone masonry", "Timber framing inserts", "Insulated mud-lime composite blocks"];
  }
  return ["Fly ash bricks", "AAC blocks", "Bamboo-laminated shading panels"];
}

export function buildResourcePlan(input: ResourcePlanInput): ResourcePlanOutput {
  const scaleFactor = SCALE_FACTOR[input.scale] ?? 1;
  const remainingShare = input.status === "Completed" ? 0.08 : clamp((100 - input.progressValue) / 100, 0.08, 1);
  const stagePressure = STAGE_PRESSURE[input.stage];
  const intensity = clamp(scaleFactor * (remainingShare * 0.85 + stagePressure * 0.4), 0.6, 6);

  const locationCostIndex = detectLocationCostIndex(input.location);
  const laborAvailability = detectLaborAvailability(
    input.geo?.population_density,
    input.geo?.terrain,
    input.geo?.climate_zone,
    input.location
  );

  const laborSpecs = [
    { role: "Architect", key: "architect", base: 1, dailyRateUsd: 220 },
    { role: "Site Engineer", key: "engineer", base: 2, dailyRateUsd: 140 },
    { role: "Masons", key: "mason", base: 8, dailyRateUsd: 45 },
    { role: "Carpenters", key: "carpenter", base: 5, dailyRateUsd: 52 },
    { role: "Electricians", key: "electrician", base: 4, dailyRateUsd: 58 },
    { role: "Plumbers", key: "plumber", base: 3, dailyRateUsd: 56 },
    { role: "Painters", key: "painter", base: 4, dailyRateUsd: 40 },
    { role: "Steel Fixers", key: "steelFixer", base: 4, dailyRateUsd: 48 }
  ] as const;

  const labor = laborSpecs.map((spec) => {
    const factor = STAGE_ROLE_FACTOR[spec.key][input.stage];
    const required = Math.max(1, Math.round(spec.base * intensity * factor));
    const estimatedDays = Math.max(3, Math.round(8 + factor * 18 * remainingShare * (scaleFactor * 0.85)));
    const totalCostUsd = required * spec.dailyRateUsd * estimatedDays * locationCostIndex;
    return {
      role: spec.role,
      required,
      availability: specializedAvailability(laborAvailability, spec.role),
      dailyRateUsd: Number((spec.dailyRateUsd * locationCostIndex).toFixed(2)),
      estimatedDays,
      totalCostUsd: Number(totalCostUsd.toFixed(2))
    };
  });

  const bucket = stageBucket(input.stage);
  const machinery = MACHINERY_SPECS.map((spec) => {
    const bucketBoost = spec.stageKey === bucket ? 1 : spec.stageKey === "structure" && bucket === "services" ? 0.6 : 0.45;
    const units = Math.max(1, Math.round(spec.baseUnits * clamp(scaleFactor * bucketBoost, 1, 4)));
    const estimatedHours = Math.max(24, Math.round(60 * remainingShare * stagePressure * scaleFactor * bucketBoost));
    const totalCostUsd = units * estimatedHours * spec.hourlyRateUsd * locationCostIndex;
    return {
      machine: spec.machine,
      units,
      availability: shiftAvailability(laborAvailability, spec.machine.includes("Crane") ? -1 : 0),
      hourlyRateUsd: Number((spec.hourlyRateUsd * locationCostIndex).toFixed(2)),
      estimatedHours,
      totalCostUsd: Number(totalCostUsd.toFixed(2))
    };
  });

  const materials = MATERIAL_SPECS.map((spec) => {
    const quantity = Math.max(spec.unit === "ton" ? 1 : 10, Math.round(spec.baseQuantity * scaleFactor * remainingShare));
    const unitCostUsd = spec.unitCostUsd * locationCostIndex;
    const totalCostUsd = quantity * unitCostUsd;
    return {
      item: spec.item,
      quantity,
      unit: spec.unit,
      availability: availabilityForMaterial(laborAvailability, spec.item, input.location),
      unitCostUsd: Number(unitCostUsd.toFixed(3)),
      totalCostUsd: Number(totalCostUsd.toFixed(2))
    };
  });

  const paints = paintPalette(input.geo?.climate_zone ?? "", input.progressValue, scaleFactor);
  const climate = normalize(input.geo?.climate_zone);
  const terrain = normalize(input.geo?.terrain);
  const soil = normalize(input.geo?.soil_condition);

  const components = dedupe(
    [
      climate.includes("coastal")
        ? "Marine-grade aluminium windows with EPDM gaskets"
        : "Powder-coated aluminium/uPVC windows with multi-point locks",
      terrain.includes("slope")
        ? "High-movement expansion joints with neoprene seals"
        : "Standard movement joints with UV-stable sealants",
      soil.includes("soft") ? "Raft slab shear connectors and settlement markers" : "Anchor plates and calibrated base plates",
      "SS304 hinges, lock plates, and corrosion-safe fasteners"
    ],
    4
  );

  const techniques = dedupe(
    [
      input.scale === "High-rise" ? "Core-first slip/jump form sequencing for vertical rise" : "Phased pour cards tied to bar-bending schedules",
      input.stage === "Services" || input.stage === "Finishing"
        ? "MEP clash checks before enclosure and finish closure"
        : "Mock-up driven quality signoff for each structural bay",
      climate.includes("coastal") || climate.includes("humid")
        ? "Two-layer waterproofing with membrane continuity checks"
        : "Thermal movement control with staged curing windows",
      "Daily procurement pull-plan synchronized with site execution"
    ],
    4
  );

  const vernacularMaterials = vernacularByLocation(input.location, input.geo?.climate_zone ?? "");

  const specialRequirements = dedupe(
    [
      `Unique requirement: ${input.projectType} typology (${input.category?.Typology ?? "inferred"}) needs phased completion package by stage.`,
      `Local requirement: source ${vernacularMaterials[0]} and ${vernacularMaterials[1]} from local vendors first to cut lead-time risk.`,
      "Control requirement: maintain hold-point checks for windows, joints, hinges, and plate alignments before handover.",
      `Procurement buffer: keep ${rangeLabel(Math.max(7, Math.round(12 * locationCostIndex)), 0.2, 3, 0)} days of critical stock for cement, steel, and fasteners.`
    ],
    4
  );

  const advanced = (input.advancedRecommendations ?? []).map((item) => item.trim()).filter(Boolean);
  const laborCore = labor.reduce((sum, row) => sum + row.required, 0);
  const cementQty = materials.find((item) => item.item === "Cement")?.quantity ?? 0;
  const acquiredPaintLots = paints.filter((item) => item.status === "Acquired").length;
  const constructionInsights = dedupe(
    [
      `Construction focus: Stage ${input.stage} at ${rangeLabel(Math.round(input.progressValue), 0.08, 0, 0)}% requires ${rangeLabel(laborCore, 0.2, 1, 0)} core workers.`,
      `Completion focus: prioritize ${components[0]} and ${components[1]} before closeout.`,
      `Replicate: keep ${input.category?.Style ?? "current"} style language with ${input.constructionType || "project"} construction system.`,
      ...advanced
    ],
    4
  );

  const procurementInsights = dedupe(
    [
      `Procurement focus: secure cement (${rangeLabel(cementQty, 0.2, 10, 0)} bags) and steel first.`,
      `Pick: prefer local ${vernacularMaterials[0]} procurement where quality certificates are available.`,
      "Do not pick: unapproved substitutions for joints, hinges, window sections, or structural plates.",
      `Labor availability for this location is ${laborAvailability}; pre-book electricians and plumbers early.`
    ],
    4
  );

  const completionInsights = dedupe(
    [
      `Special completion requirement: execute ${techniques[0]} to protect schedule reliability.`,
      `Paint panel status: ${rangeLabel(acquiredPaintLots, 0.25, 0, 0)} of ${rangeLabel(paints.length, 0.05, 1, 0)} paint lots acquired.`,
      `Unique site context: ${input.geo?.terrain ?? "terrain inferred"} / ${input.geo?.soil_condition ?? "soil inferred"} should drive final QA checklists.`,
      ...specialRequirements
    ],
    4
  );

  return {
    progressValue: input.progressValue,
    laborAvailability,
    locationCostIndex,
    labor,
    machinery,
    materials,
    paints,
    components,
    techniques,
    specialRequirements,
    vernacularMaterials,
    constructionInsights,
    procurementInsights,
    completionInsights
  };
}
