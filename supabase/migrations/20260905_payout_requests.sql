create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id),
  status text not null default 'pending',
  amount numeric,
  requested_at timestamptz not null default now()
);
alter table public.payout_requests enable row level security;
create policy payout_own on public.payout_requests for all using (driver_id = auth.uid()) with check (driver_id = auth.uid());
