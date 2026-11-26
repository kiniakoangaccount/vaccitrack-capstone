-- Deliver in-app notification changes to open workspaces immediately.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Keep database-generated notifications consistent with the current status name.
create or replace function public.notify_overdue_vaccines()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_name text;
  v_due date;
begin
  for v_owner, v_name, v_due in
    select user_id, name, next_due_date
    from public.animals
    where next_due_date is not null
      and next_due_date < current_date
      and user_id is not null
  loop
    insert into public.notifications (user_id, title, message, type, dedupe_key)
    values (
      v_owner,
      'Expired vaccination',
      format('%s''s vaccination expired on %s. Please schedule a follow-up.', v_name, to_char(v_due, 'Mon DD, YYYY')),
      'danger',
      format('overdue:%s:%s', v_owner, v_due)
    )
    on conflict do nothing;
  end loop;
  return new;
end;
$$;

-- Update unread legacy notices so the panel uses the current wording right away.
update public.notifications
set title = 'Expired vaccination',
    message = replace(message, 'vaccination was due on', 'vaccination expired on')
where title = 'Vaccination overdue'
  and is_read = false;
