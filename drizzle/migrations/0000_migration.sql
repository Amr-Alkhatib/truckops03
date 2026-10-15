
create type public.app_role as enum ('admin','staff','planner');
create type public.booking_status as enum ('draft','awaiting_approval','confirmed','rejected','cancelled','completed');
create type public.venue_type as enum ('public_ground','private_campus');
create type public.truck_status as enum ('active','retired');
create type public.pair_rule_type as enum ('never_same_day','never_same_event','max_one_of_group_on_weekend_day','allowed_together');

-- roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','staff'))
$$;

create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  company_name text not null default '',
  billing_address text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email);
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'planner');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- config (single row)
create table public.app_config (
  id int primary key default 1 check (id = 1),
  config jsonb not null,
  updated_at timestamptz not null default now()
);
grant select on public.app_config to authenticated, anon;
grant update on public.app_config to authenticated;
grant all on public.app_config to service_role;
alter table public.app_config enable row level security;
create policy "config readable" on public.app_config for select to authenticated, anon using (true);
create policy "admin updates config" on public.app_config for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.app_config (id, config) values (1, '{
  "per_guest_price": 14,
  "min_spend_per_truck": 1200,
  "weekend_surcharge_pct": 20,
  "weekend_applies_to": ["food","crew"],
  "travel_zones": [{"max_km":10,"fee":40},{"max_km":25,"fee":80},{"max_km":40,"fee":120}],
  "max_distance_km": 40,
  "generator_fee": 150,
  "espresso_price": 350,
  "crew_max_hours": 6,
  "second_crew_enabled": true,
  "second_crew_fee_per_truck": 180,
  "vegan_threshold_pct": 15,
  "vat": {"food":7,"beverage":19,"services":19,"permit":0},
  "approval_threshold": 4000,
  "approval_basis": "net",
  "depot": {"label":"Stuttgart city centre depot","lat":48.7784,"lon":9.1800},
  "afterwork_package": {"name":"Afterwork Party","start":"17:00","end":"23:30"}
}'::jsonb);

-- trucks
create table public.trucks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  cuisine text not null,
  max_guests int not null default 100,
  vegan boolean not null default false,
  gluten_free boolean not null default false,
  halal boolean not null default false,
  height_m numeric(4,2) not null,
  footprint_m2 numeric(6,2) not null,
  needs_400v boolean not null default false,
  is_addon boolean not null default false,
  status truck_status not null default 'active',
  created_at timestamptz not null default now()
);
grant select on public.trucks to authenticated, anon;
grant insert, update, delete on public.trucks to authenticated;
grant all on public.trucks to service_role;
alter table public.trucks enable row level security;
create policy "trucks readable" on public.trucks for select to authenticated, anon using (true);
create policy "staff manage trucks" on public.trucks for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

insert into public.trucks (name,cuisine,max_guests,vegan,gluten_free,halal,height_m,footprint_m2,needs_400v,is_addon,status) values
('Big Bertha','Burgers',100,false,false,false,3.2,24,true,false,'active'),
('Taco Loco','Tacos',100,true,true,false,3.0,18,false,false,'active'),
('Salsa Sister','Burritos',100,false,true,false,3.0,18,false,false,'active'),
('Smokey Joe','BBQ',100,false,true,false,3.4,18,false,false,'active'),
('Green Machine','Vegan bowls',100,true,true,false,2.9,18,false,false,'active'),
('Wurst Case Scenario','Currywurst',100,false,false,false,3.6,18,false,false,'active'),
('Dough Bros','Pizza',100,true,false,false,3.3,18,false,false,'active'),
('Curry Up','Indian',100,true,false,true,3.1,18,false,false,'active'),
('Nonna''s Pasta','Pasta',50,false,false,true,3.1,18,false,false,'retired'),
('Pho Real','Pho',100,false,true,true,3.0,18,false,false,'active'),
('Espresso Express','Coffee',0,false,false,false,2.8,8,false,true,'active');

create table public.truck_blackouts (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id) on delete cascade,
  start_date date,
  end_date date,
  recurring_month int check (recurring_month between 1 and 12),
  reason text not null default ''
);
grant select on public.truck_blackouts to authenticated, anon;
grant insert, update, delete on public.truck_blackouts to authenticated;
grant all on public.truck_blackouts to service_role;
alter table public.truck_blackouts enable row level security;
create policy "blackouts readable" on public.truck_blackouts for select to authenticated, anon using (true);
create policy "staff manage blackouts" on public.truck_blackouts for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
insert into public.truck_blackouts (truck_id, recurring_month, reason) select id, 1, 'Unavailable every January' from public.trucks where name='Pho Real';

create table public.pair_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type pair_rule_type not null,
  truck_ids uuid[] not null,
  description text not null default '',
  active boolean not null default true
);
grant select on public.pair_rules to authenticated, anon;
grant insert, update, delete on public.pair_rules to authenticated;
grant all on public.pair_rules to service_role;
alter table public.pair_rules enable row level security;
create policy "rules readable" on public.pair_rules for select to authenticated, anon using (true);
create policy "staff manage rules" on public.pair_rules for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
insert into public.pair_rules (rule_type, truck_ids, description)
select 'never_same_day', array_agg(id), 'Taco Loco and Salsa Sister share one crew' from public.trucks where name in ('Taco Loco','Salsa Sister');
insert into public.pair_rules (rule_type, truck_ids, description)
select 'max_one_of_group_on_weekend_day', array_agg(id), 'Only one of Taco Loco, Salsa Sister, Dough Bros per Saturday/Sunday' from public.trucks where name in ('Taco Loco','Salsa Sister','Dough Bros');
insert into public.pair_rules (rule_type, truck_ids, description)
select 'never_same_event', array_agg(id), 'Green Machine and Wurst Case Scenario never at the same event' from public.trucks where name in ('Green Machine','Wurst Case Scenario');
insert into public.pair_rules (rule_type, truck_ids, description)
select 'allowed_together', array_agg(id), 'Smokey Joe x Green Machine collab' from public.trucks where name in ('Smokey Joe','Green Machine');

-- towns
create table public.towns (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  permit_name text not null default '',
  issuing_authority text not null default '',
  contact text not null default '',
  fee_model text not null default 'flat' check (fee_model in ('flat','per_truck','per_m2')),
  fee_amount numeric(10,2) not null default 0,
  lead_time_weeks int not null default 4,
  max_trucks int not null default 5,
  generators_allowed boolean not null default true,
  quiet_hours_start time,
  quiet_hours_mode text not null default 'warn' check (quiet_hours_mode in ('warn','block')),
  notes text not null default '',
  verified_on date
);
grant select on public.towns to authenticated, anon;
grant insert, update, delete on public.towns to authenticated;
grant all on public.towns to service_role;
alter table public.towns enable row level security;
create policy "towns readable" on public.towns for select to authenticated, anon using (true);
create policy "staff manage towns" on public.towns for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
insert into public.towns (name,permit_name,issuing_authority,contact,fee_model,fee_amount,lead_time_weeks,max_trucks,generators_allowed,quiet_hours_start,quiet_hours_mode,notes,verified_on) values
('Stuttgart','Sondernutzungserlaubnis','Amt für öffentliche Ordnung (Ordnungsamt)','https://www.stuttgart.de','per_truck',85,4,6,false,'22:00','warn','Generators not permitted on public ground in the city centre.','2026-01-15'),
('Ludwigsburg','Sondernutzungserlaubnis','Fachbereich Sicherheit und Ordnung','https://www.ludwigsburg.de','flat',120,6,4,true,'22:00','warn','Permit required, verify current fee and conditions with the Ordnungsamt.',null);

-- compliance
create table public.compliance_docs (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null check (doc_type in ('reisegewerbekarte','food_registration','ifsg_belehrung','tuev','liability_insurance','other')),
  label text not null,
  truck_id uuid references public.trucks(id) on delete cascade,
  crew_member text,
  expires_on date,
  required boolean not null default true,
  notes text not null default ''
);
grant select, insert, update, delete on public.compliance_docs to authenticated;
grant all on public.compliance_docs to service_role;
alter table public.compliance_docs enable row level security;
create policy "staff manage compliance" on public.compliance_docs for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
insert into public.compliance_docs (doc_type,label,expires_on) values
('reisegewerbekarte','Reisegewerbekarte (§55 GewO)','2028-12-31'),
('food_registration','Registration with Lebensmittelüberwachung Stuttgart',null),
('liability_insurance','Business liability insurance','2027-03-31');
insert into public.compliance_docs (doc_type,label,crew_member,expires_on) values
('ifsg_belehrung','Infektionsschutz-Belehrung (§43 IfSG)','Lena Maier','2029-05-01'),
('ifsg_belehrung','Infektionsschutz-Belehrung (§43 IfSG)','Jonas Weber','2029-02-10');
insert into public.compliance_docs (doc_type,label,truck_id,expires_on)
select 'tuev','TÜV inspection – '||name, id, '2027-06-30' from public.trucks where status='active';

-- presets
create table public.event_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text not null,
  venue_name text not null,
  address text not null,
  town text not null default '',
  lat double precision,
  lon double precision,
  venue_type venue_type not null,
  has_400v boolean not null default false,
  clearance_m numeric(4,2),
  space_m2 numeric(8,2) not null,
  start_time time not null,
  end_time time not null,
  guests int not null,
  vegan int not null default 0,
  gluten_free int not null default 0,
  halal int not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.event_presets to authenticated;
grant all on public.event_presets to service_role;
alter table public.event_presets enable row level security;
create policy "own presets" on public.event_presets for all to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid())) with check (user_id = auth.uid());

-- bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('RF-' || upper(substr(md5(random()::text),1,6))),
  user_id uuid not null,
  status booking_status not null default 'draft',
  package text not null,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  venue_name text not null,
  address text not null,
  town text not null,
  lat double precision not null,
  lon double precision not null,
  venue_type venue_type not null,
  has_400v boolean not null,
  clearance_m numeric(4,2),
  space_m2 numeric(8,2) not null,
  guests int not null,
  vegan int not null,
  gluten_free int not null,
  halal int not null,
  espresso boolean not null default false,
  company_name text not null,
  billing_address text not null,
  po_number text not null,
  contact_name text not null,
  contact_mobile text not null,
  approver_name text,
  approver_email text,
  approval_token text unique,
  client_response_reason text,
  truck_ids uuid[] not null default '{}',
  distance_km numeric(8,2) not null,
  distance_method text not null,
  distance_computed_at timestamptz not null,
  quote jsonb not null,
  total_net numeric(12,2) not null,
  total_gross numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "own or staff read bookings" on public.bookings for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "staff update bookings" on public.bookings for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.booking_audit (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status booking_status,
  to_status booking_status not null,
  actor text not null,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.booking_audit to authenticated;
grant all on public.booking_audit to service_role;
alter table public.booking_audit enable row level security;
create policy "audit read" on public.booking_audit for select to authenticated using (
  public.is_staff(auth.uid()) or exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));

create or replace function public.log_booking_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_label text;
begin
  actor_label := coalesce(current_setting('app.actor', true), (select email from public.profiles where id = auth.uid()), 'system');
  if tg_op = 'INSERT' then
    insert into public.booking_audit (booking_id, from_status, to_status, actor, note) values (new.id, null, new.status, actor_label, 'Created');
  elsif new.status is distinct from old.status then
    insert into public.booking_audit (booking_id, from_status, to_status, actor, note) values (new.id, old.status, new.status, actor_label, nullif(current_setting('app.note', true),''));
  end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger bookings_audit_ins after insert on public.bookings for each row execute function public.log_booking_status();
create trigger bookings_audit_upd before update on public.bookings for each row execute function public.log_booking_status();

-- leads needing review
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  reason text not null,
  town text,
  payload jsonb not null,
  status text not null default 'needs_review',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;
create policy "insert own lead" on public.leads for insert to authenticated with check (user_id = auth.uid());
create policy "read leads" on public.leads for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "staff update leads" on public.leads for update to authenticated using (public.is_staff(auth.uid()));

-- cross-booking truck occupancy (no personal data)
create or replace function public.truck_occupancy(_from date, _to date)
returns table (event_date date, truck_id uuid)
language sql stable security definer set search_path = public as $$
  select b.event_date, unnest(b.truck_ids) from public.bookings b
  where b.event_date between _from and _to and b.status in ('awaiting_approval','confirmed','completed')
$$;
grant execute on function public.truck_occupancy(date, date) to authenticated;

-- compliance check without exposing docs
create or replace function public.compliance_status(_on date)
returns table (doc_type text, label text, truck_id uuid, crew_member text, expires_on date, expired boolean)
language sql stable security definer set search_path = public as $$
  select doc_type, label, truck_id, crew_member, expires_on, (expires_on is not null and expires_on < _on)
  from public.compliance_docs where required
$$;
grant execute on function public.compliance_status(date) to authenticated;

-- public approval by token
create or replace function public.get_booking_by_token(_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(x) from (
    select ref, status, package, event_date, start_time, end_time, venue_name, address, guests, company_name, po_number,
           contact_name, approver_name, quote, total_net, total_gross, client_response_reason, distance_km
    from public.bookings where approval_token = _token and length(_token) >= 32
  ) x
$$;
grant execute on function public.get_booking_by_token(text) to anon, authenticated;

create or replace function public.respond_to_approval(_token text, _accept boolean, _reason text)
returns text language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where approval_token = _token and length(_token) >= 32;
  if not found then raise exception 'Invalid link'; end if;
  if b.status <> 'awaiting_approval' then raise exception 'This quote has already been answered'; end if;
  perform set_config('app.actor', coalesce(b.approver_email,'client approver'), true);
  perform set_config('app.note', left(coalesce(_reason,''), 500), true);
  update public.bookings set status = case when _accept then 'confirmed'::booking_status else 'rejected'::booking_status end,
    client_response_reason = left(_reason, 500)
  where id = b.id;
  return case when _accept then 'confirmed' else 'rejected' end;
end; $$;
grant execute on function public.respond_to_approval(text, boolean, text) to anon, authenticated;

create or replace function public.set_booking_status(_id uuid, _status booking_status, _note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then
    if not exists (select 1 from public.bookings where id = _id and user_id = auth.uid()) or _status <> 'cancelled' then
      raise exception 'Not allowed';
    end if;
  end if;
  perform set_config('app.note', coalesce(_note,''), true);
  update public.bookings set status = _status where id = _id;
end; $$;
grant execute on function public.set_booking_status(uuid, booking_status, text) to authenticated;
