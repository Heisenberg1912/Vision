import { GoogleGenerativeAI } from "@google/generative-ai";
import { mustGetEnv } from "./env";

let cachedGenAI: GoogleGenerativeAI | null = null;

function getApiKey() {
  return mustGetEnv("GEMINI_API_KEY");
}

function getGenAI() {
  if (!cachedGenAI) {
    cachedGenAI = new GoogleGenerativeAI(getApiKey());
  }
  return cachedGenAI;
}

const DEFAULT_VISION_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const FALLBACK_VISION_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-flash-latest",
  "gemini-pro-latest"
];

const MODEL_LIST_TTL_MS = 6 * 60 * 60 * 1000;
let cachedModelList: { at: number; models: string[] } | null = null;

async function listAvailableModels() {
  const now = Date.now();
  if (cachedModelList && now - cachedModelList.at < MODEL_LIST_TTL_MS) {
    return cachedModelList.models;
  }
  try {
    const apiKey = getApiKey();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: "GET"
    });
    if (!res.ok) throw new Error(`ListModels failed: ${res.status}`);
    const data = (await res.json()) as any;
    const models = Array.isArray(data?.models) ? data.models : [];
    const names = models
      .filter((model: any) => Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes("generateContent"))
      .map((model: any) => String(model?.name ?? "").replace(/^models\//, ""))
      .filter((name: string) => name.startsWith("gemini-"));
    cachedModelList = { at: now, models: names };
    return names;
  } catch {
    return [];
  }
}

function uniqueModels(primary: string | undefined, fallbacks: string[]) {
  const items = [primary, ...fallbacks].filter(Boolean) as string[];
  return Array.from(new Set(items));
}

export function modelVision(modelName?: string) {
  const model = modelName ?? DEFAULT_VISION_MODEL;
  return getGenAI().getGenerativeModel({ model });
}

export async function generateVisionContent(parts: Parameters<ReturnType<typeof modelVision>["generateContent"]>[0], overrideModel?: string) {
  const available = await listAvailableModels();
  const allowAny = available.length === 0;
  const preferred = FALLBACK_VISION_MODELS.filter((name) => allowAny || available.includes(name));
  const pool = preferred.length ? preferred : allowAny ? FALLBACK_VISION_MODELS : available;
  const primary = overrideModel ?? DEFAULT_VISION_MODEL;
  const candidates = uniqueModels(allowAny || available.includes(primary) ? primary : undefined, pool);
  let lastError: unknown = null;
  for (const name of candidates) {
    try {
      const model = modelVision(name);
      return await model.generateContent(parts);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("No Gemini vision model available.");
}

export function toInlineData(base64DataUrl: string) {
  const m = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  return { mimeType: m[1], data: m[2] };
}
