import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { dbConnect } from "../../../../lib/mongo";
import { Session, User } from "../../../../lib/models";
import { newToken, setSessionCookieHeader } from "../../../../lib/auth-next";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required")
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = Body.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    await dbConnect();
    const emailLower = parsed.data.email.toLowerCase();

    // Find user with password field included
    const user = await User.findOne({ email: emailLower })
      .select("+password")
      .lean<{
        password: string;
        name: string;
        subscription?: { plan?: string; status?: string; endDate?: string };
      }>();

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // Verify password
    const isMatch = await bcrypt.compare(parsed.data.password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = newToken();
    await Session.create({ token, email: emailLower });

    // Determine effective plan — same logic as /api/usage
    const sub = user.subscription;
    const isActivePro =
      sub?.plan === "pro" &&
      sub?.status === "active" &&
      (!sub?.endDate || new Date(sub.endDate) > new Date());
    const plan = isActivePro ? "pro" : (sub?.plan ?? "free");

    const response = NextResponse.json({ ok: true, plan, name: user.name });
    response.headers.append("Set-Cookie", setSessionCookieHeader(token));
    return response;
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
