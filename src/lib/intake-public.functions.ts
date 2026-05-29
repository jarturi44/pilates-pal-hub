import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createPublicIntakeCheckoutOnServer,
  getIntakeSessionInfoOnServer,
  getIntakeInfoByResumeTokenOnServer,
  claimIntakeForUserOnServer,
} from "./intake-public.server";

const EMAIL = z.string().email().max(254);

export const createPublicIntakeCheckout = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    name: z.string().min(1).max(120),
    email: EMAIL,
    returnUrl: z.string().url(),
  }).parse(input))
  .handler(async ({ data }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error("Payments are not configured yet.");
    return createPublicIntakeCheckoutOnServer({
      stripeSecretKey,
      name: data.name,
      email: data.email,
      returnUrl: data.returnUrl,
    });
  });

export const getIntakeSessionInfo = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    sessionId: z.string().min(8).max(255),
  }).parse(input))
  .handler(async ({ data }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error("Payments are not configured yet.");
    return getIntakeSessionInfoOnServer({ stripeSecretKey, sessionId: data.sessionId });
  });

export const getIntakeInfoByResumeToken = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    token: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data }) => {
    return getIntakeInfoByResumeTokenOnServer({ token: data.token });
  });

export const claimIntakeForUser = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    sessionId: z.string().min(8).max(255).optional(),
    resumeToken: z.string().uuid().optional(),
    email: EMAIL,
  }).parse(input))
  .handler(async ({ data }) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) throw new Error("Payments are not configured yet.");
    return claimIntakeForUserOnServer({
      stripeSecretKey,
      sessionId: data.sessionId,
      resumeToken: data.resumeToken,
      email: data.email,
    });
  });
