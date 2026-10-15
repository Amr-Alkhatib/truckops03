CREATE OR REPLACE FUNCTION public.commit_day_plan(_date date, _snapshot text, _new jsonb, _changes jsonb, _actor text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare c jsonb; cur text; b public.bookings;
begin
  perform pg_advisory_xact_lock(hashtext('truckops-day-' || _date::text));
  select md5(coalesce(string_agg(booking_id::text || ':' || truck_id::text, ',' order by booking_id, truck_id), '')) into cur from public.assignments where event_date = _date;
  if cur <> _snapshot then raise exception 'stale_plan'; end if;
  perform set_config('app.engine', 'on', true);
  perform set_config('app.actor', coalesce(_actor, 'engine'), true);
  if _new is not null then
    insert into public.bookings select * from jsonb_populate_record(null::public.bookings, _new);
  end if;
  for c in select * from jsonb_array_elements(coalesce(_changes, '[]'::jsonb)) loop
    select * into b from public.bookings where id = (c->>'id')::uuid for update;
    if not found then continue; end if;
    perform set_config('app.note', coalesce(c->>'note', ''), true);
    update public.bookings set
      truck_ids = case when c ? 'truck_ids' then coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(c->'truck_ids') x), '{}'::uuid[]) else truck_ids end,
      quote = coalesce(c->'quote', quote),
      total_net = coalesce((c->>'total_net')::numeric, total_net),
      total_gross = coalesce((c->>'total_gross')::numeric, total_gross),
      status = coalesce((c->>'status')::booking_status, status),
      yard_distances = case when c ? 'yard_distances' then yard_distances || (c->'yard_distances') else yard_distances end,
      conflict_reason = case when c ? 'conflict_reason' then c->>'conflict_reason' else conflict_reason end
    where id = b.id;
    if c ? 'truck_ids' and (c->>'note') is not null and (c->>'status') is null then
      insert into public.booking_audit (booking_id, from_status, to_status, actor, note) values (b.id, b.status, b.status, coalesce(_actor,'engine'), c->>'note');
    end if;
    if (c->>'notify') is not null then
      insert into public.staff_notifications (booking_id, kind, message) values (b.id, coalesce(c->>'kind','reassign'), c->>'notify');
    end if;
  end loop;
  delete from public.assignments where event_date = _date;
  insert into public.assignments (booking_id, truck_id, event_date)
    select bk.id, unnest(bk.truck_ids), bk.event_date from public.bookings bk
    where bk.event_date = _date and bk.status in ('awaiting_approval','permit_check','confirmed','conflict','completed');
  select md5(coalesce(string_agg(booking_id::text || ':' || truck_id::text, ',' order by booking_id, truck_id), '')) into cur from public.assignments where event_date = _date;
  return cur;
end; $$;
REVOKE EXECUTE ON FUNCTION public.commit_day_plan(date, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_day_plan(date, text, jsonb, jsonb, text) TO service_role;