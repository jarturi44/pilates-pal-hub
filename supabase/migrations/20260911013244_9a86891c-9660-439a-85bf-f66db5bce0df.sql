-- lovable-cron-fallback-reviewed: 96 runs/day; existing class-starting-soon reminder needs a 15-minute window to notify clients before their session; re-created only to raise the HTTP timeout
select cron.unschedule('send-mornings-reminders-daily');
select cron.schedule('send-mornings-reminders-daily','0 14 * * *', $cron$
  select net.http_post(
    url := 'https://pilateswithjon.com/api/public/hooks/send-mornings-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);

select cron.unschedule('send-session-reminders-daily');
select cron.schedule('send-session-reminders-daily','0 15 * * *', $cron$
  select net.http_post(
    url := 'https://pilateswithjon.com/api/public/hooks/send-session-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);

select cron.unschedule('send-session-starting-soon');
select cron.schedule('send-session-starting-soon','*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://pilateswithjon.com/api/public/hooks/send-session-starting-soon',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);

select cron.unschedule('send-onboarding-reminders-daily');
select cron.schedule('send-onboarding-reminders-daily','0 10 * * *', $cron$
  select net.http_post(
    url := 'https://pilateswithjon.com/api/public/hooks/send-onboarding-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);

select cron.unschedule('billing-jobs-daily');
select cron.schedule('billing-jobs-daily','0 13 * * *', $cron$
  select net.http_post(
    url := 'https://pilateswithjon.com/api/public/hooks/billing-jobs',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);

select cron.unschedule('portal-launch-oneshot');