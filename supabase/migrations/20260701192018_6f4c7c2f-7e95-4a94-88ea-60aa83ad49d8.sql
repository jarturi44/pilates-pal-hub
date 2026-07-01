DO $$
DECLARE
  msg_id text := gen_random_uuid()::text;
BEGIN
  INSERT INTO public.email_send_log(message_id, template_name, recipient_email, status)
  VALUES (msg_id, 'portal-launch', 'jon.arturi@gmail.com', 'pending');

  PERFORM enqueue_email('transactional_emails', jsonb_build_object(
    'message_id', msg_id,
    'to', 'jon.arturi@gmail.com',
    'from', 'Pilates with Jon <noreply@mail.pilateswithjon.com>',
    'sender_domain', 'mail.pilateswithjon.com',
    'subject', '[Test] Domain verification check',
    'html', '<p>Domain verification test — if you got this, mail.pilateswithjon.com is sending live.</p>',
    'text', 'Domain verification test — if you got this, mail.pilateswithjon.com is sending live.',
    'purpose', 'transactional',
    'label', 'domain-verify-test',
    'idempotency_key', 'domain-verify-test-' || msg_id,
    'queued_at', now()
  ));
END $$;