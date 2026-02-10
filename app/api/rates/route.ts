import { NextRequest, NextResponse } from "next/server";

let rateCache: { base: string; rates: Record<string, number>; updatedAt: number; fetchedAt: number } | null = null;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const base = (searchParams.get("base") || "USD").toUpperCase();
  const now = Date.now();

  if (rateCache && rateCache.base === base && now - rateCache.fetchedAt < 6 * 60 * 60 * 1000) {
    return NextResponse.json({ base: rateCache.base, rates: rateCache.rates, updatedAt: rateCache.updatedAt });
  }

  const url = `https://open.er-api.com/v6/latest/${base}`;
  const response = await fetch(url);
  if (!response.ok) {
    return NextResponse.json({ error: "RATE_FETCH_FAILED" }, { status: 502 });
  }
  const data = (await response.json()) as any;
  if (data?.result !== "success" || !data?.rates) {
    return NextResponse.json({ error: "RATE_BAD_RESPONSE" }, { status: 502 });
  }

  rateCache = {
    base,
    rates: data.rates,
    updatedAt: data.time_last_update_unix ? data.time_last_update_unix * 1000 : now,
    fetchedAt: now
  };

  return NextResponse.json({ base: rateCache.base, rates: rateCache.rates, updatedAt: rateCache.updatedAt });
}
