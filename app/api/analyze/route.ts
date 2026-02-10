import { NextRequest, NextResponse } from "next/server";
import { ensureUsageKey, getUsageState, incrementFreeUse, withCookies } from "../../../lib/auth-next";
import { generateVisionContent, toInlineData } from "../../../lib/gemini";
import { buildBasePrompt } from "../../../lib/gemini-tuning";
import { BaseResultSchema } from "../../../lib/schema";
import { AnalyzeBody, sanitizeBase, buildFallbackBase } from "../../../lib/sanitize";
import { dbConnect } from "../../../lib/mongo";
import { User } from "../../../lib/models";

export const maxDuration = 60;

async function incrementScanCount(email: string | null, deviceKey: string) {
  if (email) {
    await dbConnect();
    await User.updateOne({ email }, { $inc: { "subscription.scans_used": 1 } });
  } else {
    await incrementFreeUse(deviceKey);
  }
}

async function getScanUsageInfo(email: string | null, deviceKey: string) {
  if (email) {
    await dbConnect();
    const user = await User.findOne({ email }, "subscription").lean<{
      subscription?: { plan?: string; status?: string; scans_limit?: number; scans_used?: number; endDate?: string };
    }>();
    const sub = user?.subscription;
    const isPro = sub?.plan === "pro" && sub?.status === "active" && (!sub?.endDate || new Date(sub.endDate) > new Date());
    const scansUsed = sub?.scans_used ?? 0;
    const scansLimit = sub?.scans_limit ?? 3;
    return {
      freeUsed: scansUsed,
      freeRemaining: isPro ? Infinity : Math.max(0, scansLimit - scansUsed),
      paid: isPro
    };
  }
  const nextState = await getUsageState(deviceKey);
  return {
    freeUsed: nextState.freeUsed,
    freeRemaining: nextState.paid ? Infinity : Math.max(0, 3 - nextState.freeUsed),
    paid: nextState.paid
  };
}

function isValidAccessCode(code: string | null): boolean {
  if (!code) return false;
  const validCodes = (process.env.ACCESS_CODES ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  return validCodes.includes(code.trim());
}

export async function POST(request: NextRequest) {
  const { key, email, cookieHeaders } = await ensureUsageKey(request);

  // Check for access code header — grants pro-level access
  const accessCodeHeader = request.headers.get("x-vision-access-code");
  const hasValidAccessCode = isValidAccessCode(accessCodeHeader);

  // If valid access code, skip scan limit checks
  if (!hasValidAccessCode) {
    if (email) {
      await dbConnect();
      const user = await User.findOne({ email }, "subscription").lean<{
        subscription?: { plan?: string; status?: string; scans_limit?: number; scans_used?: number; endDate?: string };
      }>();
      const sub = user?.subscription;
      const isActivePro = sub?.plan === "pro" && sub?.status === "active" && (!sub?.endDate || new Date(sub.endDate) > new Date());
      const scansLimit = sub?.scans_limit ?? 3;
      const scansUsed = sub?.scans_used ?? 0;
      // Pro users with active subscription and valid endDate bypass limits
      if (!isActivePro && scansLimit !== -1 && scansUsed >= scansLimit) {
        return withCookies(
          { error: "PAYWALL", message: `Scan limit reached (${scansUsed}/${scansLimit}). Please upgrade to Pro.` },
          402,
          cookieHeaders
        );
      }
    } else {
      // Anonymous user — use device-based usage tracking
      const state = await getUsageState(key);
      if (!state.paid && state.freeUsed >= 3) {
        return withCookies(
          { error: "PAYWALL", message: "Free limit reached. Please sign in and upgrade." },
          402,
          cookieHeaders
        );
      }
    }
  }

  const raw = await request.json();
  const parsed = AnalyzeBody.safeParse(raw);
  if (!parsed.success) {
    return withCookies({ error: "BAD_REQUEST", issues: parsed.error.issues }, 400, cookieHeaders);
  }
  const body = parsed.data;
  const inline = toInlineData(body.imageDataUrl);

  let result;
  try {
    result = await generateVisionContent([{ text: buildBasePrompt(body.meta) }, { inlineData: inline }]);
  } catch (err: any) {
    const fallbackBase = buildFallbackBase(body.meta);
    const fallbackParsed = BaseResultSchema.safeParse(fallbackBase);
    if (!fallbackParsed.success) {
      return withCookies(
        { error: "MODEL_ERROR", message: err?.message ?? "Model request failed." },
        502,
        cookieHeaders
      );
    }
    await incrementScanCount(email, key);
    const usageInfo = await getScanUsageInfo(email, key);
    return withCookies(
      {
        base: fallbackParsed.data,
        usage: usageInfo,
        warning: "MODEL_FALLBACK_USED",
        message: err?.message ?? "Model request failed."
      },
      200,
      cookieHeaders
    );
  }

  const text = result.response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return withCookies({ error: "BAD_MODEL_OUTPUT", raw: text }, 500, cookieHeaders);
    json = JSON.parse(m[0]);
  }

  const sanitized = sanitizeBase(json, body.meta);
  const baseParsed = BaseResultSchema.safeParse(sanitized);
  if (!baseParsed.success) {
    return withCookies(
      { error: "SCHEMA_MISMATCH", raw: json, issues: baseParsed.error.issues },
      500,
      cookieHeaders
    );
  }

  await incrementScanCount(email, key);
  const usageInfo = await getScanUsageInfo(email, key);

  return withCookies(
    { base: baseParsed.data, usage: usageInfo },
    200,
    cookieHeaders
  );
}
