-- Restrict direct database writes to purok lookup records to profile admins.
-- The hidden super-admin dashboard writes with the service-role client.
drop policy if exists "Staff can manage puroks" on public.puroks;
drop policy if exists "Admins can manage puroks" on public.puroks;
create policy "Admins can manage puroks"
  on public.puroks for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Publish purok changes so open workspaces can refresh their risk/report areas.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'puroks'
    ) then
    alter publication supabase_realtime add table public.puroks;
  end if;
end $$;
