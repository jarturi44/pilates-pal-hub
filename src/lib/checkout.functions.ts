import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createCheckoutSessionOnServer,
  syncCheckoutSessionOnServer,
  createBillingPortalSessionOnServer,
  recoverSubscriptionByEmailOnServer,
  createIntakeCheckoutOnServer,
  syncIntakeCheckoutOnServer,
  subscribeWithSavedCardOnServer,
} from "./checkout.server";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    planId: z.string().uuid(),
    returnUrl: z.string().url(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error("Payments are not configured yet.");
    return createCheckoutSessionOnServer({
      stripeSecretKey,
      userId: context.userId,
      userEmail: typeof context.claims.email === "string" ? context.claims.email : undefined,
      planId: data.planId,
      returnUrl: data.returnUrl,
    });
  });

export const syncCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    sessionId: z.string().min(8).max(255),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error("Payments are not configured yet.");
    return syncCheckoutSessionOnServer({
      stripeSecretKey,
      userId: context.userId,
      sessionId: data.sessionId,
    });
  });

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    returnUrl: z.string().url(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error("Payments are not configured yet.");
    return createBillingPortalSessionOnServer({
      stripeSecretKey,
      userId: context.userId,
      returnUrl: data.returnUrl,
    });
  });

export const recoverSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error("Payments are not configured yet.");
    return recoverSubscriptionByEmailOnServer({
      stripeSecretKey,
      userId: context.userId,
    });
  });
export const createIntakeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    returnUrl: z.string().url(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error("Payments are not configured yet.");
    return createIntakeCheckoutOnServer({
      stripeSecretKey,
      userId: context.userId,
      userEmail: typeof context.claims.email === "string" ? context.claims.email : undefined,
      returnUrl: data.returnUrl,
    });
  });

export const syncIntakeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    sessionId: z.string().min(8).max(255),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error("Payments are not configured yet.");
    return syncIntakeCheckoutOnServer({
      stripeSecretKey,
      userId: context.userId,
      sessionId: data.sessionId,
    });
  });
