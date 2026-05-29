
-- Pending intakes: paid before account creation
CREATE TABLE public.pending_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  stripe_session_id text NOT NULL UNIQUE,
  stripe_payment_intent_id text,
  amount_paid integer,
  paid_at timestamptz NOT NULL DEFAULT now(),
  intake_completed_at timestamptz,
  intake_completed_by uuid,
  claimed_by_user_id uuid,
  claimed_at timestamptz,
  resume_token uuid NOT NULL DEFAULT gen_random_uuid(),
  resume_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pending_intakes_email_unclaimed_idx
  ON public.pending_intakes (lower(email))
  WHERE claimed_by_user_id IS NULL;

CREATE INDEX pending_intakes_resume_token_idx ON public.pending_intakes (resume_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_intakes TO authenticated;
GRANT ALL ON public.pending_intakes TO service_role;

ALTER TABLE public.pending_intakes ENABLE ROW LEVEL SECURITY;

-- Only admins can see/manage pending intakes; the public flow uses service-role server fns.
CREATE POLICY pi_admin_all ON public.pending_intakes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER pending_intakes_set_updated_at
BEFORE UPDATE ON public.pending_intakes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
