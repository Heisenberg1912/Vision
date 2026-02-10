import { NextRequest, NextResponse } from "next/server";
import { ensureUsageKey, getUsageState, withCookies } from "../../../lib/auth-next";
import { generateVisionContent, toInlineData } from "../../../lib/gemini";
import { buildAdvancedPrompt } from "../../../lib/gemini-tuning";
import { AdvancedResultSchema } from "../../../lib/schema";
import { AdvancedBody, baseIsValid, sanitizeAdvanced } from "../../../lib/sanitize";
import { dbConnect } from "../../../lib/mongo";
import { User } from "../../../lib/models";

export const maxDuration = 60;

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

  const accessCodeHeader = request.headers.get("x-vision-access-code");
  const hasValidAccessCode = isValidAccessCode(accessCodeHeader);

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
      if (!isActivePro && scansLimit !== -1 && scansUsed >= scansLimit) {
        return withCookies(
          { error: "PAYWALL", message: `Scan limit reached (${scansUsed}/${scansLimit}). Please upgrade to Pro.` },
          402,
          cookieHeaders
        );
      }
    } else {
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
  const parsed = AdvancedBody.safeParse(raw);
  if (!parsed.success) {
    return withCookies({ error: "BAD_REQUEST", issues: parsed.error.issues }, 400, cookieHeaders);
  }
  const body = parsed.data;

  if (!baseIsValid(body.base)) {
    return withCookies(
      { error: "BASE_INVALID", message: "Base analysis incomplete or out of range." },
      400,
      cookieHeaders
    );
  }

  const inline = toInlineData(body.imageDataUrl);

  let result;
  try {
    result = await generateVisionContent([
      { text: buildAdvancedPrompt(body.language) + "\n\nBASE_RESULT_JSON:\n" + JSON.stringify(body.base) },
      { inlineData: inline }
    ]);
  } catch (err: any) {
    const fallback = sanitizeAdvanced({}, body.base);
    const advancedParsed = AdvancedResultSchema.safeParse(fallback);
    if (!advancedParsed.success) {
      return withCookies(
        { error: "MODEL_ERROR", message: err?.message ?? "Model request failed." },
        502,
        cookieHeaders
      );
    }
    return withCookies(
      {
        advanced: advancedParsed.data,
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

  const sanitized = sanitizeAdvanced(json, body.base);
  const advancedParsed = AdvancedResultSchema.safeParse(sanitized);
  if (!advancedParsed.success) {
    return withCookies(
      { error: "SCHEMA_MISMATCH", raw: json, issues: advancedParsed.error.issues },
      500,
      cookieHeaders
    );
  }

  return withCookies({ advanced: advancedParsed.data }, 200, cookieHeaders);
}
