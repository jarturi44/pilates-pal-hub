
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'present';

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late_canceled'));

CREATE UNIQUE INDEX IF NOT EXISTS attendance_user_slot_date_uidx
  ON public.attendance (user_id, slot_id, session_date);

-- Allow clients to insert their own attendance? No — admin only. Existing RLS already restricts writes via admin role.
-- Add a policy allowing admins UPDATE explicitly is covered by ALL policy.
