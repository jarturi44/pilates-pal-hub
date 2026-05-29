## New client journey

```
Landing → Signup → Pay $60 intake session → "Thanks, Jon will reach out" page
                                              ↓
                          (Jon conducts intake live, then in admin:
                           marks intake_complete + sets times/dates)
                                              ↓
Next login → Plan selector (3 cards, qty boxes) → Stripe checkout
          → Sign waiver → Home
```

## 1. Rename plan types (DB + code)

Migration:
- Add `'one_on_one'` and `'small_group'` to the `session_type` and `plan_type` enums
- Update existing `plans` rows: `private → one_on_one`, `semi_private → small_group`
- Update existing `slots.session_type` rows the same way
- Drop old enum values

Code: search/replace `"private"` / `"semi_private"` / `"Private"` / `"Semi-Private"` across `src/**` (slots, attendance, admin UIs, labels).

## 2. New intake purchase step

DB migration: add to `users`:
- `intake_paid_at timestamptz`
- `intake_completed_at timestamptz`
- `availability_notes text` (admin-only field — replaces the client availability form)

New Stripe checkout product: $60 one-time (not subscription). Add `create-intake-checkout` flow — reuse `create-checkout` edge fn with a new `mode: "payment"` branch, or simpler: a new server fn `createIntakeCheckout` that creates a `mode=payment` Stripe session for $60, redirects back with `?intake=success`. On success, write `intake_paid_at`.

## 3. Rebuild `/onboarding` flow

Replace the existing onboarding wizard with linear states based on user fields:

| User state | Shows |
|---|---|
| `!intake_paid_at` | "Pay for your intake session — $60" (shipping form + Stripe checkout for $60 one-time) |
| `intake_paid_at && !intake_completed_at` | "Thanks! Jon will reach out to schedule your intake." (no further action) |
| `intake_completed_at && !subscription` | Plan picker (see §4) |
| `subscription && !waiver_signed` | Waiver step |
| All done | redirect `/home` |

Availability step is **removed** from this flow entirely.

## 4. New plan picker (3 categories + qty)

Three cards:
- **10 Minute Mornings** — flat $X/mo, single "Select" button
- **Small Group** — qty stepper (1–7 sessions/week), price = $Y × qty
- **One-On-One** — qty stepper (1–7 sessions/week), price = $Z × qty

Add to `plans` table: `category text` ('mornings' | 'small_group' | 'one_on_one'), `price_per_session numeric`. Migration seeds three "template" plans. Checkout multiplies qty × price_per_session and passes to Stripe as a custom price.

## 5. Admin: intake management

On `clients/$clientId`:
- "Intake paid" badge if `intake_paid_at`
- "Mark intake complete" button → sets `intake_completed_at` (unlocks plan picker for client)
- New "Availability notes" textarea (saves to `users.availability_notes`)
- Existing slot-assignment UI stays (admin assigns times after intake)

## 6. `_authenticated` gate update

`src/routes/_authenticated.tsx` redirect logic updated to route to `/onboarding` until all of: `intake_paid_at`, `intake_completed_at`, active subscription, signed waiver. Waiver becomes the last step before `/home`.

## 7. Files touched

- migrations: enum rename, `users` columns, `plans` columns + seeded rows
- `supabase/functions/create-checkout/index.ts` — support one-time intake mode + dynamic qty pricing
- `src/routes/_authenticated/onboarding.tsx` — major rewrite (remove availability step, add intake-paid state, new plan picker)
- `src/routes/_authenticated/onboarding_.setup.tsx` — strip availability step, leave waiver only
- `src/routes/_authenticated.tsx` — new gate logic
- `src/routes/_authenticated/clients.$clientId.tsx` — admin intake controls + availability notes
- `src/routes/_authenticated/slots.tsx`, `attendance.tsx`, `dashboard.tsx`, etc. — rename labels
- `src/routes/_authenticated/settings.tsx` — any plan/session labels
- `src/lib/checkout.server.ts` / `checkout.functions.ts` — qty param

## Open questions to confirm before I start

1. **Plan pricing** — what's the $/session for Small Group and One-On-One, and $/mo for 10 Min Mornings? (I'll seed the new plan rows.)
2. **What happens to existing test users mid-flow?** I'll set `intake_paid_at` + `intake_completed_at` to `now()` for anyone who already has a subscription, so they don't get bounced back to the intake step.
