import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PROMPT = `From this image of a coupon, promo code, gift card, store credit, or loyalty card, extract its details.
Return ONLY a JSON object (no prose, no code fences) with these keys:
- kind: one of "coupon","gift_card","store_credit","loyalty","other"
- brand: the store/brand name, or null
- brand_domain: best-guess website host like "quince.com" (lowercase, no www/https), or null
- code: the coupon code or gift-card number as shown, or null
- pin: the gift-card PIN if present, else null
- value_initial: the dollar amount as a number (e.g. 50), or the percent number for a % coupon (e.g. 20), else null
- discount_type: "amount" for a $ value / gift card, "percent" for % off, else null
- expires_at: expiration as "YYYY-MM-DD", or null
- barcode_format: "qr","code128","upc","ean", or null
If something isn't visible, use null. Respond with ONLY the JSON object.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ai_not_configured" });
  }

  let body: { imageBase64?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { imageBase64, mediaType } = body;
  if (!imageBase64 || !mediaType || !/^image\/(png|jpeg|jpg|webp|gif)$/.test(mediaType)) {
    return NextResponse.json({ error: "bad_image" }, { status: 400 });
  }
  // ~8 MB base64 cap
  if (imageBase64.length > 8_000_000) return NextResponse.json({ error: "image_too_large" }, { status: 413 });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: "You extract structured data from photos of coupons and gift cards. You only ever output a single JSON object.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as "image/png", data: imageBase64 } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    const text = msg.content.find((b) => b.type === "text")?.text ?? "{}";
    const jsonStr = text.replace(/```json|```/g, "").trim();
    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(jsonStr);
    } catch {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          extracted = JSON.parse(m[0]);
        } catch {
          /* give up — return empty */
        }
      }
    }
    return NextResponse.json({ ok: true, extracted });
  } catch (e) {
    return NextResponse.json({ error: "extract_failed", detail: (e as Error).message }, { status: 502 });
  }
}
