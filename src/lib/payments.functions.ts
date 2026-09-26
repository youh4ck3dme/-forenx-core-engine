import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
  paymentsConfigured,
} from "@/lib/stripe.server";
import { ACTIVE_STATUSES } from "@/config/billing";

type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };

export type SubscriptionState = {
  configured: boolean;
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  environment: StripeEnv;
};

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0]!.id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({
      email: options.email,
      limit: 1,
    });
    if (existing.data.length) {
      const customer = existing.data[0]!;
      if (options.userId && customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

/** Stav predplatného sa vždy číta z overeného záznamu, nikdy zo success stránky. */
export const getSubscriptionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<SubscriptionState> => {
    const { supabase, userId } = context;
    const configured = paymentsConfigured(data.environment);

    const { data: row } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .maybeSingle();

    const active =
      row &&
      ACTIVE_STATUSES.includes(row.status) &&
      (!row.current_period_end ||
        new Date(row.current_period_end).getTime() > Date.now());

    return {
      configured,
      plan: active && row?.plan === "pro" ? "pro" : "free",
      status: row?.status ?? "inactive",
      currentPeriodEnd: row?.current_period_end ?? null,
      cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
      environment: data.environment,
    };
  });

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId))
        throw new Error("Neplatný identifikátor ceny.");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    if (!paymentsConfigured(data.environment)) {
      return {
        error:
          "Platby nie sú nakonfigurované. Chýba platobné pripojenie prostredia.",
      };
    }
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length)
        return { error: "Cena sa nenašla — chýba price_id v katalógu." };
      const stripePrice = prices.data[0]!;

      const {
        data: { user },
      } = await context.supabase.auth.getUser();

      const customerId = await resolveOrCreateCustomer(stripe, {
        ...(user?.email ? { email: user.email } : {}),
        userId: context.userId,
      });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: stripePrice.type === "recurring" ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        managed_payments: { enabled: true },
        metadata: { userId: context.userId, managed_payments: "true" },
        ...(stripePrice.type === "recurring" && {
          subscription_data: { metadata: { userId: context.userId } },
        }),
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalResult> => {
    if (!paymentsConfigured(data.environment)) {
      return { error: "Platby nie sú nakonfigurované." };
    }
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("customer_id")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .maybeSingle();

    if (!sub?.customer_id) return { error: "Zatiaľ nemáte žiadne predplatné." };

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
