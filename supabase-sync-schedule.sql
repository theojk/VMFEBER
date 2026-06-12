-- Kjor denne i Supabase SQL Editor etter at sync-world-cup er deployet.
-- Bytt ut de tre PLACEHOLDER-verdiene for du kjorer filen.
-- Samme hemmelige verdi ma lagres som Edge Function-secret SYNC_CRON_SECRET.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule(jobid)
from cron.job
where jobname = 'vm-feber-resultatsynkronisering';

select vault.create_secret(
  'https://DIN-PROSJEKT-ID.supabase.co',
  'vm_feber_sync_project_url'
);

select vault.create_secret(
  'DIN-PUBLISHABLE-ELLER-ANON-KEY',
  'vm_feber_sync_publishable_key'
);

select vault.create_secret(
  'DIN-EGEN-LANGE-TILFELDIGE-SYNC-NOKKEL',
  'vm_feber_sync_cron_secret'
);

-- Vekker funksjonen hvert 15. minutt. Den kaller bare football-data.org nar:
-- 1. minst en kamp startet for minst to timer siden og ikke er finished, og
-- 2. det er minst en time siden forrige kontroll.
select cron.schedule(
  'vm-feber-resultatsynkronisering',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
      where name = 'vm_feber_sync_project_url' order by created_at desc limit 1)
      || '/functions/v1/sync-world-cup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
        where name = 'vm_feber_sync_publishable_key' order by created_at desc limit 1),
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets
        where name = 'vm_feber_sync_cron_secret' order by created_at desc limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Kontroll:
-- select jobid, jobname, schedule, active from cron.job
-- where jobname = 'vm-feber-resultatsynkronisering';
