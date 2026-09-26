-- Admin allowlist: info@bizagent.sk (+ legacy erikbabcan@gmail.com).
-- Updates signup trigger and grants admin to existing matching profiles.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_emails text[] := array[
    'info@bizagent.sk',
    'erikbabcan@gmail.com'
  ];
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
  values (
    new.id,
    case
      when lower(coalesce(new.email, '')) = any (admin_emails)
        then 'admin'::public.app_role
      else 'user'::public.app_role
    end
  )
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- Existujúci účet s info@bizagent.sk → admin (ak už je v auth/profiles).
insert into public.user_roles (user_id, role)
select p.id, 'admin'::public.app_role
from public.profiles p
where lower(coalesce(p.email, '')) in ('info@bizagent.sk', 'erikbabcan@gmail.com')
on conflict (user_id, role) do nothing;
