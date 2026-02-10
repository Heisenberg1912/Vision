import { NextRequest, NextResponse } from "next/server";
import { ensureUsageKey, getUsageState, withCookies } from "../../../lib/auth-next";
import { dbConnect } from "../../../lib/mongo";
import { User } from "../../../lib/models";

export async function GET(request: NextRequest) {
  const { key, email, cookieHeaders } = await ensureUsageKey(request);
  const state = await getUsageState(key);

  let plan: string | null = null;
  let name: string | null = null;
  let scansLimit = 3;
  let scansUsed = 0;

  if (email) {
    await dbConnect();
    const user = await User.findOne({ email }, "subscription name").lean<{
      name?: string;
      subscription?: { plan?: string; status?: string; scans_limit?: number; scans_used?: number; endDate?: string };
    }>();
    const sub = user?.subscription;
    const isProPlan = sub?.plan === "pro" && sub?.status === "active" && (!sub?.endDate || new Date(sub.endDate) > new Date());
    plan = isProPlan ? "pro" : (sub?.plan === "pro" ? "expired" : (sub?.plan ?? "free"));
    name = user?.name ?? null;
    scansLimit = sub?.scans_limit ?? 3;
    scansUsed = sub?.scans_used ?? 0;
  }

  const isPro = plan === "pro";
  const freeRemaining = isPro ? null : Math.max(0, scansLimit - scansUsed);

  return withCookies(
    { freeUsed: scansUsed, freeRemaining, paid: isPro, email, plan, name, scansLimit, scansUsed },
    200,
    cookieHeaders
  );
}
