## New flow

```
Landing
  → /get-started   (name + email + 3-month acknowledgement + "Pay $60")
  → Stripe Checkout (mode=payment, customer_email locked)
  → /onboarding/create-account?session_id=...   (email locked, set password)
  → /onboarding   (already logged in, lands on "Thanks, Jon will reach out")
```

After Jon marks intake complete in admin, any paid client who hasn't created an account yet gets a "finish setting up your account" email with a one-time resume link.

## Database

New table `pending_intakes`:
- `email` (text, unique), `name` (text)
- `stripe_session_id`, `stripe_payment_intent_id`, `amount_paid`
- `paid_at`, `intake_completed_at`, `claimed_by_user_id`
- `resume_token` (uuid), `resume_email_sent_at`

Created on Stripe success. When a user signs up with that email, `claimed_by_user_id` is set and the matching `users` row gets `intake_paid_at` (+ `intake_completed_at` if Jon already marked it complete on the pending_intakes row).

## New / changed files

- **New public route** `src/routes/get-started.tsx` — name/email form, 3-month acknowledgement copy (moved from `IntakePaymentStep`), "Pay $60" button.
- **New public server fn** `src/lib/intake-public.functions.ts`:
  - `createPublicIntakeCheckout({ name, email, returnUrl })` — no auth, creates Stripe `mode=payment` session with `customer_email`, name in metadata, success URL `/onboarding/create-account?session_id={CHECKOUT_SESSION_ID}`.
  - `getIntakeSessionInfo({ sessionId })` — verifies Stripe session is paid, returns `{ email, name }`, upserts `pending_intakes` row.
  - `claimIntakeForUser` — called after signup, links auth user ↔ pending_intakes, sets `users.intake_paid_at`.
- **New public route** `src/routes/onboarding_.create-account.tsx` — reads `session_id`, fetches info, renders signup form with email locked and pre-filled name, calls `supabase.auth.signUp` then `claimIntakeForUser`, redirects to `/onboarding`.
- **Landing page** (`src/routes/index.tsx`) — CTA buttons point to `/get-started` instead of `/signup`.
- **Onboarding** (`src/routes/_authenticated/onboarding.tsx`) — remove `IntakePaymentStep` (now public). State machine for logged-in users starts at "Thanks, Jon will reach out" if `intake_paid_at && !intake_completed_at`. Plan picker + waiver steps unchanged.
- **Auth gate** (`src/routes/_authenticated.tsx`) — unchanged logic; signup flow ensures `intake_paid_at` is already set when the account is created.
- **Admin client list** (`src/routes/_authenticated/clients.tsx` + `clients.$clientId.tsx`) — show paid-but-unclaimed `pending_intakes` rows alongside real clients so Jon can mark their intake complete. Marking complete on an unclaimed row triggers the "finish setup" email.
- **Resume email**: new transactional template `intake-finish-signup.tsx` with a link `/onboarding/create-account?resume=<token>`. The create-account route accepts either `session_id` or `resume` token.

## Stripe webhook

`supabase/functions/stripe-webhook` — on `checkout.session.completed` for `mode=payment` with metadata `flow=intake`, upsert `pending_intakes` (idempotent). Belt-and-suspenders so the success-page server fn isn't the only writer.

## What I will NOT touch

- Existing plan picker, waiver step, slot/availability admin UI.
- Existing subscription / past-due / suspended logic.
- Branding, colors, copy outside `/get-started` and the new account-create page.

## Open question (one)

For the resume email to actually send, I need the transactional email infra scaffolded (it isn't yet — only auth emails exist). I'll set that up as part of this work. Confirm or say "skip the email for now and I'll wire it later".