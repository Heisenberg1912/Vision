import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({ code: z.string().min(1) });

export async function POST(request: NextRequest) {
  const raw = await request.json();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Access code is required." }, { status: 400 });
  }

  const validCodes = (process.env.ACCESS_CODES ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  if (validCodes.length === 0) {
    return NextResponse.json({ error: "Access codes are not configured." }, { status: 500 });
  }

  if (!validCodes.includes(parsed.data.code.trim())) {
    return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, plan: "pro" });
}
