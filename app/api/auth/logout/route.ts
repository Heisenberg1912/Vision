import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "../../../../lib/mongo";
import { Session } from "../../../../lib/models";
import { clearSessionCookieHeader } from "../../../../lib/auth-next";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("va_session")?.value;

  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookieHeader());

  if (token) {
    await dbConnect();
    await Session.deleteOne({ token });
  }

  return response;
}
