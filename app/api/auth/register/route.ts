import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { dbConnect } from "../../../../lib/mongo";
import { Session, User } from "../../../../lib/models";
import { newToken, setSessionCookieHeader } from "../../../../lib/auth-next";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required")
});

export async function POST(request: NextRequest) {
  const raw = await request.json();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  await dbConnect();
  const emailLower = parsed.data.email.toLowerCase();

  // Check if user already exists
  const existing = await User.findOne({ email: emailLower }).lean();
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
  }

  // Create user with free plan
  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
  await User.create({
    email: emailLower,
    password: hashedPassword,
    name: parsed.data.name,
    role: "user",
    isActive: true,
    subscription: {
      plan: "free",
      status: "active",
      scans_limit: 3,
      projects_limit: 1,
      scans_used: 0,
      features: {
        predictive_analytics: false,
        smart_alerts: false,
        portfolio_view: false,
        advanced_financials: false,
        quality_control: false,
        custom_reports: false
      }
    }
  });

  // Auto-login after registration
  const token = newToken();
  await Session.create({ token, email: emailLower });

  const response = NextResponse.json({ ok: true, plan: "free", name: parsed.data.name });
  response.headers.append("Set-Cookie", setSessionCookieHeader(token));
  return response;
}
