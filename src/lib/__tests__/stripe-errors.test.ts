import { describe, expect, it } from "vitest";
import { getStripeErrorMessage, paymentsConfigured } from "@/lib/stripe.server";

describe("Payments error contract", () => {
  it("paymentsConfigured je false bez kľúčov", () => {
    const prevS = process.env["STRIPE_SANDBOX_SECRET_KEY"];
    delete process.env["STRIPE_SANDBOX_SECRET_KEY"];
    try {
      expect(paymentsConfigured("sandbox")).toBe(false);
    } finally {
      if (prevS) process.env["STRIPE_SANDBOX_SECRET_KEY"] = prevS;
    }
  });

  it("getStripeErrorMessage skladá hlášku z Stripe objektu, inak generic", () => {
    expect(
      getStripeErrorMessage({
        message: "card declined",
        code: "card_declined",
        decline_code: "insufficient_funds",
      }),
    ).toContain("card declined");
    expect(getStripeErrorMessage("nope")).toBe("Stripe request failed");
    expect(getStripeErrorMessage(null)).toBe("Stripe request failed");
  });
});
