-- Daypad phase 1a: permanently remove items that have been in the recycle bin (soft-deleted) for 30 days.
-- Runs nightly at 03:15 UTC with pg_cron.

create extension if not exists pg_cron with schema pg_catalog;

create function public.purge_deleted()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.tasks where deleted_at < now() - interval '30 days';
  delete from public.notes where deleted_at < now() - interval '30 days';
  delete from public.lists where deleted_at < now() - interval '30 days';
$$;

revoke all on function public.purge_deleted() from public, anon, authenticated;

select cron.schedule('purge-deleted-items', '15 3 * * *', $$ select public.purge_deleted(); $$);
