create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_site_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create table if not exists public.site_content (
  id text primary key,
  content jsonb not null,
  is_published boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

drop policy if exists "Published content is public" on public.site_content;
create policy "Published content is public"
on public.site_content
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Only listed admins can insert content" on public.site_content;
create policy "Only listed admins can insert content"
on public.site_content
for insert
to authenticated
with check (public.is_site_admin());

drop policy if exists "Only listed admins can update content" on public.site_content;
create policy "Only listed admins can update content"
on public.site_content
for update
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

drop policy if exists "Only listed admins can delete content" on public.site_content;
create policy "Only listed admins can delete content"
on public.site_content
for delete
to authenticated
using (public.is_site_admin());

create or replace function public.set_site_content_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_site_content_updated_at on public.site_content;
create trigger set_site_content_updated_at
before insert or update on public.site_content
for each row execute function public.set_site_content_updated_at();

insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Site media is public" on storage.objects;
create policy "Site media is public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'site-media');

drop policy if exists "Only listed admins can upload site media" on storage.objects;
create policy "Only listed admins can upload site media"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'site-media' and public.is_site_admin());

drop policy if exists "Only listed admins can update site media" on storage.objects;
create policy "Only listed admins can update site media"
on storage.objects
for update
to authenticated
using (bucket_id = 'site-media' and public.is_site_admin())
with check (bucket_id = 'site-media' and public.is_site_admin());

drop policy if exists "Only listed admins can delete site media" on storage.objects;
create policy "Only listed admins can delete site media"
on storage.objects
for delete
to authenticated
using (bucket_id = 'site-media' and public.is_site_admin());

insert into public.admin_users (email)
values
  ('rej.madetodanceph@gmail.com'),
  ('mick.madetodanceph@gmail.com')
on conflict (email) do nothing;
