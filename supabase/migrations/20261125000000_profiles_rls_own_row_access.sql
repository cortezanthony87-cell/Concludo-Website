alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;

grant select on public.profiles to authenticated;
grant insert (id, email, full_name, plan, role) on public.profiles to authenticated;
grant update (full_name, updated_at, country, city, timezone) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = id and plan = 'free_preview' and role = 'user');

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
