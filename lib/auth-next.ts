import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbConnect } from "./mongo";
import { Session, Usage } from "./models";

const SESSION_COOKIE = "va_session";
const DEVICE_COOKIE = "va_device";

function cookieBaseOptions() {
  const isProd = process.env.NODE_ENV === "production";
  const sameSiteEnv = process.env.COOKIE_SAMESITE;
  const sameSite =
    sameSiteEnv === "lax" || sameSiteEnv === "strict" || sameSiteEnv === "none"
      ? sameSiteEnv
      : isProd
        ? "none"
        : "lax";
  const secureEnv = process.env.COOKIE_SECURE;
  const secure = secureEnv ? secureEnv === "true" : isProd && sameSite === "none";
  return { httpOnly: true, sameSite: sameSite as "lax" | "strict" | "none", secure, path: "/" };
}

function buildCookieHeader(name: string, value: string, maxAge: number): string {
  const opts = cookieBaseOptions();
  return `${name}=${value}; Path=${opts.path}; Max-Age=${maxAge}; HttpOnly${opts.secure ? "; Secure" : ""}; SameSite=${opts.sameSite}`;
}

export async function getAuthEmail(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await dbConnect();
  const sess = await Session.findOne({ token }).lean<{ email: string }>();
  return sess?.email ?? null;
}

export function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function ensureUsageKey(
  request: NextRequest
): Promise<{ key: string; email: string | null; cookieHeaders: string[] }> {
  const email = await getAuthEmail(request);
  if (email) return { key: email, email, cookieHeaders: [] };

  let device = request.cookies.get(DEVICE_COOKIE)?.value;
  const cookieHeaders: string[] = [];
  if (!device) {
    device = crypto.randomBytes(16).toString("hex");
    cookieHeaders.push(buildCookieHeader(DEVICE_COOKIE, device, 60 * 60 * 24 * 365));
  }
  return { key: `device:${device}`, email: null, cookieHeaders };
}

export function setSessionCookieHeader(token: string): string {
  return buildCookieHeader(SESSION_COOKIE, token, 60 * 60 * 24 * 30);
}

export function clearSessionCookieHeader(): string {
  return buildCookieHeader(SESSION_COOKIE, "", 0);
}

type UsageRow = { key: string; freeUsed: number; paid: boolean };

export async function getUsageState(key: string) {
  await dbConnect();
  const row = await Usage.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, freeUsed: 0, paid: false } },
    { upsert: true, new: true }
  ).lean<UsageRow>();
  return row ?? { key, freeUsed: 0, paid: false };
}

export async function incrementFreeUse(key: string) {
  await dbConnect();
  const row = await Usage.findOneAndUpdate(
    { key },
    { $inc: { freeUsed: 1 } },
    { new: true }
  ).lean<UsageRow>();
  return row ?? { key, freeUsed: 0, paid: false };
}

export function withCookies(data: any, status: number, cookieHeaders: string[]): NextResponse {
  const response = NextResponse.json(data, { status });
  for (const header of cookieHeaders) {
    response.headers.append("Set-Cookie", header);
  }
  return response;
}
