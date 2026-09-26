-- ============ roles ============
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Users can read own roles"
on public.user_roles for select to authenticated
using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- ============ shared trigger fn ============
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ profiles ============
create table public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Users can view own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create trigger update_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- ============ new user handling ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, case when lower(new.email) = 'erikbabcan@gmail.com' then 'admin'::public.app_role else 'user'::public.app_role end)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ cases ============
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  subtitle text not null default '',
  reference_date date not null default current_date,
  europol_serials text[] not null default '{}',
  valid_licences text[] not null default '{}',
  orsr_addresses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.cases to authenticated;
grant all on public.cases to service_role;

alter table public.cases enable row level security;

create policy "Users manage own cases"
on public.cases for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger update_cases_updated_at
before update on public.cases
for each row execute function public.update_updated_at_column();

create index cases_user_id_idx on public.cases (user_id);

-- ============ entities ============
create table public.case_entities (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  kind text not null default 'person',
  role text not null default '',
  ico text,
  address text,
  registered_address text,
  licence text,
  incorporated_at date,
  physical_inventory boolean,
  responsive boolean,
  country text not null default 'SK',
  x numeric not null default 50,
  y numeric not null default 50,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.case_entities to authenticated;
grant all on public.case_entities to service_role;

alter table public.case_entities enable row level security;

create policy "Users manage own case entities"
on public.case_entities for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger update_case_entities_updated_at
before update on public.case_entities
for each row execute function public.update_updated_at_column();

create index case_entities_case_id_idx on public.case_entities (case_id);

-- ============ transactions ============
create table public.case_transactions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null,
  date date not null,
  amount numeric not null default 0,
  method text not null default 'transfer',
  from_id uuid references public.case_entities(id) on delete set null,
  to_id uuid references public.case_entities(id) on delete set null,
  payer_id uuid references public.case_entities(id) on delete set null,
  origin_country text not null default 'SK',
  destination_country text not null default 'SK',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.case_transactions to authenticated;
grant all on public.case_transactions to service_role;

alter table public.case_transactions enable row level security;

create policy "Users manage own case transactions"
on public.case_transactions for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger update_case_transactions_updated_at
before update on public.case_transactions
for each row execute function public.update_updated_at_column();

create index case_transactions_case_id_idx on public.case_transactions (case_id);

-- ============ weapons ============
create table public.case_weapons (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null,
  brand text not null default '',
  model text not null default '',
  serial text not null default '',
  holder_id uuid references public.case_entities(id) on delete set null,
  supplier_id uuid references public.case_entities(id) on delete set null,
  acquired_at date,
  licence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.case_weapons to authenticated;
grant all on public.case_weapons to service_role;

alter table public.case_weapons enable row level security;

create policy "Users manage own case weapons"
on public.case_weapons for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger update_case_weapons_updated_at
before update on public.case_weapons
for each row execute function public.update_updated_at_column();

create index case_weapons_case_id_idx on public.case_weapons (case_id);

-- ============ relations ============
create table public.case_relations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null,
  from_id uuid references public.case_entities(id) on delete cascade,
  to_id uuid references public.case_entities(id) on delete cascade,
  label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.case_relations to authenticated;
grant all on public.case_relations to service_role;

alter table public.case_relations enable row level security;

create policy "Users manage own case relations"
on public.case_relations for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger update_case_relations_updated_at
before update on public.case_relations
for each row execute function public.update_updated_at_column();

create index case_relations_case_id_idx on public.case_relations (case_id);

-- ============ events ============
create table public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null,
  date date not null,
  title text not null default '',
  detail text not null default '',
  severity text not null default 'low',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.case_events to authenticated;
grant all on public.case_events to service_role;

alter table public.case_events enable row level security;

create policy "Users manage own case events"
on public.case_events for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger update_case_events_updated_at
before update on public.case_events
for each row execute function public.update_updated_at_column();

create index case_events_case_id_idx on public.case_events (case_id);

-- ============ storage policies for private-bucket (admin only) ============
create policy "Admins can read private bucket"
on storage.objects for select to authenticated
using (bucket_id = 'private-bucket' and public.has_role(auth.uid(), 'admin'));

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;