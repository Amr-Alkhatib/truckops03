
create or replace function public.log_booking_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_label text;
begin
  actor_label := coalesce(nullif(current_setting('app.actor', true),''), (select email from public.profiles where id = auth.uid()), (select email from public.profiles where id = new.user_id), 'system');
  if tg_op = 'INSERT' then
    insert into public.booking_audit (booking_id, from_status, to_status, actor, note) values (new.id, null, new.status, actor_label, 'Booking submitted');
  elsif new.status is distinct from old.status then
    insert into public.booking_audit (booking_id, from_status, to_status, actor, note) values (new.id, old.status, new.status, actor_label, nullif(current_setting('app.note', true),''));
  end if;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return new;
end; $$;
