-- Appointment creation and management are admin-only. BHW accounts can read
-- appointments assigned to them; server actions also limit their status updates
-- to those assigned appointments.
drop policy if exists "Staff can manage appointments" on public.appointments;
drop policy if exists "Admins can manage appointments" on public.appointments;
create policy "Admins can manage appointments"
  on public.appointments for all to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

drop policy if exists "Assigned BHW can view appointments" on public.appointments;
create policy "Assigned BHW can view appointments"
  on public.appointments for select to authenticated
  using (
    assigned_to = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'bhw')
  );
