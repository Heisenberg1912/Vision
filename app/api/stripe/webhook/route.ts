import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { dbConnect } from "../../../../lib/mongo";
import { Usage } from "../../../../lib/models";

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any });
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "NO_SIGNATURE" }, { status: 400 });
  }

  // In Next.js App Router, request body is not pre-parsed.
  // request.text() gives us the raw body needed for Stripe signature verification.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json(
      { error: "BAD_SIGNATURE", message: err?.message ?? "Invalid signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const usageKey = session.metadata?.usageKey;
    if (usageKey) {
      await dbConnect();
      await Usage.findOneAndUpdate({ key: usageKey }, { $set: { paid: true } }, { upsert: true });
    }
  }

  return NextResponse.json({ received: true });
}
