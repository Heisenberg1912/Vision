import { z } from "zod";

export const StageEnum = z.enum(["Planning", "Foundation", "Structure", "Services", "Finishing", "Completed"]);

const uniqueList = <T extends z.ZodTypeAny>(schema: T, max = 5) =>
  z
    .array(schema)
    .max(max)
    .refine((items) => new Set(items).size === items.length, { message: "No duplicates allowed." })
    .default([]);

export const BaseResultSchema = z.object({
  project_status: z.enum(["under_construction", "completed"]),
  stage_of_construction: StageEnum,
  progress_percent: z.number().min(0).max(100),
  timeline: z.object({
    hours_remaining: z.number().nonnegative(),
    manpower_hours: z.number().nonnegative(),
    machinery_hours: z.number().nonnegative()
  }),
  category_matrix: z.object({
    Category: z.string().min(1),
    Typology: z.string().min(1),
    Style: z.string().min(1),
    ClimateAdaptability: z.string().min(1),
    Terrain: z.string().min(1),
    SoilType: z.string().min(1),
    MaterialUsed: z.string().min(1),
    InteriorLayout: z.string().min(1),
    RoofType: z.string().min(1),
    Exterior: z.string().min(1),
    AdditionalFeatures: z.string().min(1),
    Sustainability: z.string().min(1)
  }),
  scope: z.object({
    stages_completed: uniqueList(StageEnum),
    stages_left: uniqueList(StageEnum),
    dependencies: uniqueList(StageEnum)
  }),
  geo_market_factors: z.object({
    terrain: z.string().min(1),
    soil_condition: z.string().min(1),
    climate_zone: z.string().min(1),
    population_density: z.string().min(1),
    master_plan_zone: z.string().min(1),
    policy_posture: z.string().min(1),
    policy_focus: z.string().min(1),
    comparable_activity: z.string().min(1),
    comparable_properties_count: z.number().min(0).max(5000),
    city_growth_5y_percent: z.number().min(-20).max(120),
    property_growth_percent: z.number().min(-20).max(120),
    land_growth_percent: z.number().min(-20).max(140),
    property_age_years: z.number().min(0).max(200),
    resale_value_percent: z.number().min(0).max(220),
    investment_roi_percent: z.number().min(-50).max(120)
  }),
  notes: z.array(z.string()).max(4).default([])
});

export const AdvancedResultSchema = z.object({
  progress_vs_ideal: z.enum(["Ahead", "On Track", "Delayed"]),
  timeline_drift: z.string().min(1),
  cost_risk_signals: uniqueList(z.string().min(1), 5),
  recommendations: z.array(z.string().min(8)).max(4).default([])
});
