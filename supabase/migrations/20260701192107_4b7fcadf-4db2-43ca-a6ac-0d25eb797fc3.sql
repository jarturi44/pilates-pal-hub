DO $$
DECLARE
  msg_id text := gen_random_uuid()::text;
  tok text := encode(gen_random_bytes(32), 'hex');
BEGIN
  INSERT INTO public.email_unsubscribe_tokens(token, email)
  VALUES (tok, 'jon.arturi@gmail.com')
  ON CONFLICT (email) DO UPDATE SET token = EXCLUDED.token WHERE email_unsubscribe_tokens.used_at IS NULL
  RETURNING token INTO tok;

  SELECT token INTO tok FROM public.email_unsubscribe_tokens WHERE email = 'jon.arturi@gmail.com';

  INSERT INTO public.email_send_log(message_id, template_name, recipient_email, status)
  VALUES (msg_id, 'domain-verify-test', 'jon.arturi@gmail.com', 'pending');

  PERFORM enqueue_email('transactional_emails', jsonb_build_object(
    'message_id', msg_id,
    'to', 'jon.arturi@gmail.com',
    'from', 'Pilates with Jon <noreply@mail.pilateswithjon.com>',
    'sender_domain', 'mail.pilateswithjon.com',
    'subject', '[Test] mail.pilateswithjon.com verification',
    'html', '<p>If you got this, mail.pilateswithjon.com is live and delivering.</p>',
    'text', 'If you got this, mail.pilateswithjon.com is live and delivering.',
    'purpose', 'transactional',
    'label', 'domain-verify-test',
    'idempotency_key', 'domain-verify-test-' || msg_id,
    'unsubscribe_token', tok,
    'queued_at', now()
  ));
END $$;