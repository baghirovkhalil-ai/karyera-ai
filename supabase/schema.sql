-- KarYera AI — Supabase sxemi (v3)
-- Supabase → SQL Editor → bu faylı tam yapışdır → Run.

-- 1) Profil: kredit serverdə saxlanır, CV və treker cihazlar arasında sinxron olur
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  credits int not null default 3 check (credits >= 0),
  data jsonb,                 -- CV vəziyyəti (app.js-dəki S)
  apps jsonb,                 -- müraciət trekeri
  job_query text,             -- Telegram bildirişi üçün axtarış sözü
  job_remote boolean not null default false,
  tg_chat_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
-- İstifadəçi krediti özü dəyişə bilməsin: yalnız bu sütunlara yazmaq icazəsi
revoke update on public.profiles from authenticated, anon;
grant update (data, apps, job_query, job_remote, updated_at) on public.profiles to authenticated;

-- Yeni istifadəçi qeydiyyatdan keçəndə profil avtomatik yaranır (3 hədiyyə kredit)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 2) Kredit xərcləmək: yalnız öz hesabından, balans çatarsa
create or replace function public.spend_credits(n int) returns int
language plpgsql security definer set search_path = public as $$
declare left_ int;
begin
  if n is null or n < 1 or n > 10 then raise exception 'bad_amount'; end if;
  update public.profiles set credits = credits - n, updated_at = now()
    where id = auth.uid() and credits >= n returning credits into left_;
  if left_ is null then raise exception 'not_enough'; end if;
  return left_;
end $$;
revoke all on function public.spend_credits(int) from public, anon;
grant execute on function public.spend_credits(int) to authenticated;

-- AI cavab verməsə krediti qaytarmaq (yalnız server)
create or replace function public.add_credits(uid uuid, n int) returns int
language plpgsql security definer set search_path = public as $$
declare bal int;
begin
  update public.profiles set credits = credits + n, updated_at = now() where id = uid returning credits into bal;
  return bal;
end $$;
revoke all on function public.add_credits(uuid, int) from public, anon, authenticated;
grant execute on function public.add_credits(uuid, int) to service_role;

-- 3) Ödənişlər: hər çek bir dəfə (receipt_key unikal) — təkrar istifadə mümkün deyil
create table if not exists public.payments (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  pack text not null,
  credits int not null,
  amount numeric,
  receipt_key text unique not null,
  receipt_date text, receipt_time text, contact text,
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;
drop policy if exists "own payments read" on public.payments;
create policy "own payments read" on public.payments for select using (auth.uid() = user_id);

-- 4) Telegram bağlantı kodları
create table if not exists public.tg_links (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.tg_links enable row level security;
drop policy if exists "own tg link insert" on public.tg_links;
create policy "own tg link insert" on public.tg_links for insert with check (auth.uid() = user_id);
