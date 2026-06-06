-- Kjor denne i Supabase SQL Editor etter at create-prediction-backup er deployet.
-- Bytt ut de tre PLACEHOLDER-verdiene for du kjorer filen.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select vault.create_secret(
  'https://DIN-PROSJEKT-ID.supabase.co',
  'vm_feber_project_url'
);

select vault.create_secret(
  'DIN-PUBLISHABLE-ELLER-ANON-KEY',
  'vm_feber_publishable_key'
);

select vault.create_secret(
  'DIN-EGEN-LANGE-TILFELDIGE-BACKUP-NOKKEL',
  'vm_feber_backup_cron_secret'
);

-- Kl. 10:00 UTC tilsvarer kl. 12:00 i Norge under VM 2026.
select cron.schedule(
  'vm-feber-daglig-backup',
  '0 10 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'vm_feber_project_url')
      || '/functions/v1/create-prediction-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vm_feber_publishable_key'),
      'x-backup-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'vm_feber_backup_cron_secret')
    ),
    body := '{"type":"daglig"}'::jsonb
  );
  $$
);

-- Kontrollerer Full VM-fristen hvert 15. minutt. Funksjonen lager bare én backup.
select cron.schedule(
  'vm-feber-full-vm-backup',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'vm_feber_project_url')
      || '/functions/v1/create-prediction-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vm_feber_publishable_key'),
      'x-backup-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'vm_feber_backup_cron_secret')
    ),
    body := '{"type":"full-vm"}'::jsonb
  );
  $$
);
