CREATE OR REPLACE FUNCTION public.queue_thanksgiving_notices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  c_html    constant text := $html$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><meta name="x-apple-disable-message-reformatting" /></head>
<body style="background-color:#f4f6fb;font-family:Inter, Helvetica, Arial, sans-serif;margin:0;padding:0">
<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Happy Thanksgiving! (Take the day off)</div>
<div style="padding:32px 28px;max-width:560px;background-color:#ffffff;border:1px solid #d0d8ec;border-radius:10px;margin:24px auto">
<div style="text-align:center;padding:8px 0 24px"><img src="https://rpqrbbecfwsuedwjglpp.supabase.co/storage/v1/object/public/branding/logo.png" alt="Pilates with Jon" width="64" height="64" style="display:inline-block;border-radius:8px" /></div>
<p style="font-size:13px;color:#1a3a6b;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin:0 0 18px">Pilates with Jon</p>
<h1 style="font-size:24px;font-weight:600;color:#1a3a6b;margin:0 0 18px;letter-spacing:-0.01em;font-family:Inter, Helvetica, Arial, sans-serif">Happy Thanksgiving!</h1>
<p style="font-size:15px;color:#0f1f3a;line-height:1.6;margin:0 0 18px">Hi {{NAME}},</p>
<p style="font-size:15px;color:#0f1f3a;line-height:1.6;margin:0 0 18px">I just wanted to send a quick note to wish you and your families a very happy Thanksgiving.</p>
<p style="font-size:15px;color:#0f1f3a;line-height:1.6;margin:0 0 18px">A heads-up: there won't be a new 10 Minute Mornings video today. I'm taking the day off, and I want you to take it off too. No workout on Thanksgiving. Enjoy your people, enjoy the food, and don't think twice about it.</p>
<p style="font-size:15px;color:#0f1f3a;line-height:1.6;margin:0 0 18px">Once you're no longer full of food (no rush), come back to the mat on Friday or Saturday. A little Pilates is a great way to get things moving again and feel like yourself after a big holiday meal.</p>
<p style="font-size:15px;color:#0f1f3a;line-height:1.6;margin:0 0 18px">Most of all, I want to say thank you. I'm truly grateful for each of you. You show up, you work hard, and you make this business something I love doing every day. Teaching you is one of the things I'm most thankful for this year.</p>
<p style="font-size:15px;color:#0f1f3a;line-height:1.6;margin:0 0 18px">Happy Thanksgiving!</p>
<p style="font-size:13px;color:#4a5a78;margin:32px 0 0">Jon<br />Pilates with Jon</p>
</div>
</body>
</html>$html$;
  c_text    constant text := $txt$Pilates with Jon

Happy Thanksgiving!

Hi {{NAME}},

I just wanted to send a quick note to wish you and your families a very happy Thanksgiving.

A heads-up: there won't be a new 10 Minute Mornings video today. I'm taking the day off, and I want you to take it off too. No workout on Thanksgiving. Enjoy your people, enjoy the food, and don't think twice about it.

Once you're no longer full of food (no rush), come back to the mat on Friday or Saturday. A little Pilates is a great way to get things moving again and feel like yourself after a big holiday meal.

Most of all, I want to say thank you. I'm truly grateful for each of you. You show up, you work hard, and you make this business something I love doing every day. Teaching you is one of the things I'm most thankful for this year.

Happy Thanksgiving!

Jon
Pilates with Jon$txt$;
  c_subject constant text := 'Happy Thanksgiving! (Take the day off)';
  c_from    constant text := 'Pilates with Jon <noreply@mail.pilateswithjon.com>';
  v_rec     record;
  v_token   text;
  v_msg     text;
  v_name    text;
  v_sent    int := 0;
  v_skipped int := 0;
  v_errors  text[] := '{}';
BEGIN
  FOR v_rec IN
    SELECT DISTINCT ON (email) email, name
    FROM (
      SELECT lower(u.email) AS email, u.name AS name
      FROM public.subscriptions s
      JOIN public.users u ON u.id = s.user_id
      WHERE s.status IN ('active','trialing') AND u.email IS NOT NULL
      UNION
      SELECT lower(mr.email) AS email, mr.name AS name
      FROM public.mornings_recipients mr
      WHERE mr.active AND mr.email IS NOT NULL
    ) b
    ORDER BY email
  LOOP
    BEGIN
      IF EXISTS (SELECT 1 FROM public.suppressed_emails e WHERE e.email = v_rec.email) THEN
        v_skipped := v_skipped + 1;
      ELSIF EXISTS (SELECT 1 FROM public.email_unsubscribe_tokens t WHERE t.email = v_rec.email AND t.used_at IS NOT NULL) THEN
        v_skipped := v_skipped + 1;
      ELSE
        v_token := NULL;
        SELECT t.token INTO v_token FROM public.email_unsubscribe_tokens t WHERE t.email = v_rec.email;
        IF v_token IS NULL THEN
          v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
          INSERT INTO public.email_unsubscribe_tokens (token, email)
            VALUES (v_token, v_rec.email) ON CONFLICT (email) DO NOTHING;
          SELECT t.token INTO v_token FROM public.email_unsubscribe_tokens t WHERE t.email = v_rec.email;
        END IF;

        IF v_token IS NULL THEN
          v_errors := array_append(v_errors, v_rec.email || ': no unsubscribe token');
        ELSE
          v_msg := 'thanksgiving-2026-11-26-' || v_rec.email;
          IF EXISTS (SELECT 1 FROM public.email_send_log l WHERE l.message_id = v_msg) THEN
            v_skipped := v_skipped + 1;
          ELSE
            v_name := coalesce(nullif(btrim(v_rec.name), ''), 'everyone');
            PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
              'message_id', v_msg,
              'to', v_rec.email,
              'from', c_from,
              'sender_domain', 'mail.pilateswithjon.com',
              'subject', c_subject,
              'html', replace(c_html, '{{NAME}}', replace(replace(replace(v_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')),
              'text', replace(c_text, '{{NAME}}', v_name),
              'purpose', 'transactional',
              'label', 'thanksgiving-notice',
              'idempotency_key', v_msg,
              'unsubscribe_token', v_token,
              'queued_at', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            ));

            INSERT INTO public.email_send_log (message_id, template_name, recipient_email, status)
              VALUES (v_msg, 'thanksgiving-notice', v_rec.email, 'pending');
            v_sent := v_sent + 1;
          END IF;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, v_rec.email || ': ' || sqlerrm);
    END;
  END LOOP;

  BEGIN
    PERFORM cron.unschedule('thanksgiving-notice-oneshot');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('sent', v_sent, 'skipped', v_skipped,
    'recipients', v_sent + v_skipped, 'errors', v_errors);
END;
$fn$;

REVOKE ALL ON FUNCTION public.queue_thanksgiving_notices() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.queue_thanksgiving_notices() TO postgres;

SELECT cron.schedule_in_database(
  'thanksgiving-notice-oneshot',
  '0 12 26 11 *',
  $$SELECT public.queue_thanksgiving_notices()$$,
  'postgres'
);