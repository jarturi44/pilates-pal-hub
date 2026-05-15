
-- Notifications: add title and optional deep link
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS link text;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id) WHERE read = false;

-- Subscriptions: grace period tracking for past_due lifecycle
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz,
  ADD COLUMN IF NOT EXISTS access_suspended boolean NOT NULL DEFAULT false;

-- Dedupe key for one-shot notifications (e.g. session reminders, commitment ending)
CREATE TABLE IF NOT EXISTS public.notification_dedupe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
ALTER TABLE public.notification_dedupe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nd_admin" ON public.notification_dedupe FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Broadcast log
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid NOT NULL,
  audience_type text NOT NULL,        -- 'all_active' | 'plan_type' | 'slot'
  audience_value text,                -- plan type or slot_id
  audience_label text,                -- human readable
  subject text NOT NULL,
  body text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "broadcasts_admin_all" ON public.broadcasts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
