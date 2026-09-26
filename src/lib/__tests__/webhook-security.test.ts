import { afterEach, describe, expect, it } from "vitest";
import { verifyWebhook } from "@/lib/stripe.server";

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Buffer.from(new Uint8Array(signed)).toString("hex");
}

function signedRequest(body: string, secret: string, timestamp: string) {
  return hmacHex(secret, `${timestamp}.${body}`).then(
    (sig) =>
      new Request("https://example.test/api/public/payments/webhook", {
        method: "POST",
        headers: { "stripe-signature": `t=${timestamp},v1=${sig}` },
        body,
      }),
  );
}

describe("Webhook security (Stripe HMAC)", () => {
  const secret = "whsec_test_secret";
  const original = process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"];

  afterEach(() => {
    if (original) process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = original;
    else delete process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"];
  });

  it("prijme platný podpis a vráti event", async () => {
    process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = secret;
    const body = JSON.stringify({
      id: "evt_test_1",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1" } },
    });
    const t = String(Math.floor(Date.now() / 1000));
    const req = await signedRequest(body, secret, t);
    const event = await verifyWebhook(req, "sandbox");
    expect(event.id).toBe("evt_test_1");
    expect(event.type).toBe("customer.subscription.updated");
  });

  it("odmietne falšovaný podpis", async () => {
    process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = secret;
    const body = JSON.stringify({
      id: "evt_x",
      type: "ping",
      data: { object: {} },
    });
    const t = String(Math.floor(Date.now() / 1000));
    const req = new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "stripe-signature": `t=${t},v1=${"0".repeat(64)}` },
      body,
    });
    await expect(verifyWebhook(req, "sandbox")).rejects.toThrow(
      "Invalid webhook signature",
    );
  });

  it("odmietne chýbajúci podpis a starý timestamp", async () => {
    process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = secret;
    const body = JSON.stringify({
      id: "evt_x",
      type: "ping",
      data: { object: {} },
    });
    const noSig = new Request("https://example.test/webhook", {
      method: "POST",
      body,
    });
    await expect(verifyWebhook(noSig, "sandbox")).rejects.toThrow(
      /Missing signature/,
    );

    const old = String(Math.floor(Date.now() / 1000) - 400);
    const stale = await signedRequest(body, secret, old);
    await expect(verifyWebhook(stale, "sandbox")).rejects.toThrow(
      /timestamp too old/,
    );
  });
});
