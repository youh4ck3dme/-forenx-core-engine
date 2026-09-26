import type { Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as
  string | undefined;

/** True keď je platobná integrácia nakonfigurovaná pre tento build. */
export function paymentsConfigured(): boolean {
  return Boolean(
    clientToken?.startsWith("pk_test_") || clientToken?.startsWith("pk_live_"),
  );
}

function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "Platby nie sú pre toto zostavenie nakonfigurované. Dokončite nastavenie platieb v projekte.",
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Načíta Stripe.js až pri prvom volaní (po kliknutí na plán / mount checkoute).
 * Import tohto modulu sám o sebe nenaťahuje js.stripe.com.
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = import("@stripe/stripe-js").then(({ loadStripe }) =>
      loadStripe(clientToken as string),
    );
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}
