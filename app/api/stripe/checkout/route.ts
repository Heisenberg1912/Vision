import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ensureUsageKey, withCookies } from "../../../../lib/auth-next";
import { dbConnect } from "../../../../lib/mongo";
import { Usage } from "../../../../lib/models";

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!stripeKey || !priceId) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 500 });
  }

  const { key, cookieHeaders } = await ensureUsageKey(request);
  await dbConnect();
  await Usage.findOneAndUpdate({ key }, { $setOnInsert: { key, freeUsed: 0, paid: false } }, { upsert: true });

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any });
  const origin = process.env.APP_URL;
  if (!origin) {
    return NextResponse.json({ error: "APP_URL_NOT_CONFIGURED" }, { status: 500 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?paid=1`,
    cancel_url: `${origin}/?cancel=1`,
    metadata: { usageKey: key }
  });

  return withCookies({ url: session.url }, 200, cookieHeaders);
}
