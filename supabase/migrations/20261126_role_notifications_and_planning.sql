-- Include each animal in expired-notice deduplication so one pet's alert does
-- not hide another pet's alert when both share an owner and due date.
create or replace function public.notify_overdue_vaccines()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_animal_id bigint;
  v_owner uuid;
  v_name text;
  v_due date;
begin
  for v_animal_id, v_owner, v_name, v_due in
    select id, user_id, name, next_due_date
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
      format('overdue:%s:%s:%s', v_owner, v_animal_id, v_due)
    )
    on conflict do nothing;
  end loop;
  return new;
end;
$$;

-- Notify clients when a due date is first added or changed on an animal.
create or replace function public.notify_vaccination_schedule()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_schedule_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    v_schedule_changed := true;
  else
    v_schedule_changed := old.next_due_date is distinct from new.next_due_date
      or old.vaccinated is distinct from new.vaccinated;
  end if;

  if new.user_id is not null
    and new.vaccinated
    and new.next_due_date is not null
    and v_schedule_changed then
    insert into public.notifications (user_id, title, message, type, dedupe_key)
    values (
      new.user_id,
      'Vaccination schedule set',
      format('%s''s next vaccination is scheduled for %s.', new.name, to_char(new.next_due_date, 'Mon DD, YYYY')),
      'info',
      format('vaccination-schedule:%s:%s', new.id, new.next_due_date)
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists animals_notify_vaccination_schedule on public.animals;
create trigger animals_notify_vaccination_schedule
after insert or update of next_due_date, vaccinated on public.animals
for each row execute function public.notify_vaccination_schedule();
